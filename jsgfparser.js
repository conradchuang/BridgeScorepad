/* vim: set ai et sw=4 sts=4: */

/*
 * Class for reading Javascript Speech Grammar Format (JSGF) files
 *
 * Unsupported:
 *   - import statements. Since this is supposed to work in a
 *     browser, access to files is problematic.
 *   - quoted stirngs. May be added later.
 *   - weights. May be added later.
 */

const Token_Symbol = 1;
const Token_Rule = 2;
const Token_String = 3;
const Token_Weight = 4;
const Token_EOF = 5;

const Expr_String = 1;
const Expr_Rule = 2;
const Expr_Group = 3;
const Expr_Optional = 4;

class JSGFParser {

    constructor(grammar) {
        this.loadGrammar(grammar);
    }

    loadGrammar(grammar) {
        this._tokens = new _Tokenizer(grammar).tokens();
        this._read_header();
        this._read_grammar();
        /* XXX this._read_imports(); */
        this._read_rules();
        this._verify();
    }

    _next_token() {
        let t = this._tokens.next();
        if (t.done)
            return [Token_EOF, null];
        else
            return [t.value[0], String(t.value[1])];
    }

    _read_header() {
        let t = this._next_token();
        if (t[0] != Token_Symbol || t[1] != "#")
            throw new SyntaxError("bad header line [1]");
        t = this._next_token();
        if (t[0] != Token_String || t[1] != "JSGF")
            throw new SyntaxError("bad header line [2]");
        t = this._next_token();
        if (t[0] != Token_String)
            throw new SyntaxError("missing JSGF version");
        this.jsgf_version = t[1];
        this.jsgf_encoding = null;
        this.jsgf_locale = null;
        t = this._next_token();
        if (t[0] == Token_String) {
            this.jsgf_encoding = t[1];
            t = this._next_token();
            if (t[0] == Token_String) {
                this.jsgf_locale = t[1];
                t = this._next_token();
            }
        }
        if (t[0] != Token_Symbol || t[1] != ";")
            throw new SyntaxError("bad header line [3]");
    }

    _read_grammar() {
        let t = this._next_token();
        if (t[0] != Token_String || t[1] != "grammar")
            throw new SyntaxError("bad name line [1]");
        t = this._next_token();
        if (t[0] != Token_String)
            throw new SyntaxError("bad name line [2]");
        this.grammar_name = t[1];
        t = this._next_token();
        if (t[0] != Token_Symbol || t[1] != ";")
            throw new SyntaxError("bad name line [3]");
    }

    _read_rules() {
        let t = this._next_token();
        this.rules = {}
        this.public_rules = [];
        while (t[0] != Token_EOF) {
            /* t is already set to first token of this rule */
            let is_public = false;
            if (t[0] == Token_String && t[1] == "public") {
                is_public = true;
                t = this._next_token();
            }
            if (t[0] != Token_Rule)
                throw new SyntaxError("bad rule [1]");
            let rule_name = t[1];
            let p = new _Production(is_public, rule_name);
            if (this.rules.hasOwnProperty(rule_name))
                console.warn("rule redefined: " + rule_name);
            this.rules[rule_name] = p;
            if (is_public)
                this.public_rules.push(rule_name);
            t = this._next_token();
            if (t[0] != Token_Symbol && t[1] != "=")
                throw new SyntaxError("bad rule [2]");
            t = this._next_token();
            while (t[0] != Token_EOF && (t[0] != Token_Symbol || t[1] != ";")) {
                switch (t[0]) {
                  case Token_Symbol:
                    switch (t[1]) {
                      case '{':
                          p.tag_start(); break;
                      case '}':
                          p.tag_end(); break;
                      case '(':
                          p.group_start(); break;
                      case ')':
                          p.group_end(); break;
                      case '[':
                          p.optional_start(); break;
                      case ']':
                          p.optional_end(); break;
                      case '*':
                          p.zero_or_more(); break;
                      case '+':
                          p.one_or_more(); break;
                      case '|':
                          p.alternative(); break;
                      case '/':
                          p.weight_toggle(); break;
                      default:
                          throw new SyntaxError("unexpected symbol: " + t[1]);
                    }
                    break;
                  case Token_Rule:
                    p.add_rule(t[1]);
                    break;
                  case Token_String:
                    p.add_string(t[1]);
                    break;
                  default:
                    throw new SyntaxError("unexpected token type: " + t[0]);
                    break;
                }
                t = this._next_token();
            }
            if (t[0] != Token_Symbol || t[1] != ";")
                throw new SyntaxError("bad rule []");
            p.finalize();
            t = this._next_token();     /* Start on next rule */
        }
    }

    _verify() {
        /* This cannot happen since public rules are always added
         * to both this.public_rules and this.rules */
        for (let public_rule of this.public_rules) {
            if (!this.rules.hasOwnProperty(public_rule))
                console.error("missing public rule: " + public_rule);
        }
        /* Make sure all referenced rules are defined */
        for (let rule_name in this.rules) {
            let rule = this.rules[rule_name];
            for (let ref_rule of rule.referenced_rules())
                if (!this.rules.hasOwnProperty(ref_rule))
                    console.error("missing referenced rule: " + ref_rule);
        }
    }

    _str_header() {
        let parts = ["#JSGF", this.jsgf_version];
        if (this.jsgf_encoding != null)
            parts.push(this.jsgf_encoding);
        if (this.jsgf_locale != null)
            parts.push(this.jsgf_locale);
        return parts.join(" ") + ";";
    }

    _str_name() {
        return "grammar " + this.grammar_name + ";";
    }

    _str_rules() {
        let rule_names = Object.keys(this.rules).sort();
        let rule_strs = [];
        for (let name of rule_names)
            rule_strs.push(this.rules[name].str());
        return rule_strs.join("\n");
    }

    str_grammar() {
        return [this._str_header(),
                this._str_name(),
                this._str_rules()].join("\n");
    }

    parse(input) {
        /* Return parse tree or throw exception */
        /* Assume that input is whitespace delimited */
        let words = new Words(input);
        /*
        console.debug("parse: " + input);
        */
        for (let public_rule of this.public_rules) {
            /*
            console.debug("check rule: " + public_rule);
            */
            try {
                let p = this.rules[public_rule];
                return { etype: Expr_Rule, ename: public_rule,
                         value: p.parse(this.rules, words) };
            } catch(err) {
                /*
                console.debug("no match with " + public_rule);
                */
            }
        }
        throw new Error("no match with any public rules");
    }
}

class _Tokenizer {

    Delimiters = /[;=|*+<>\[\]{}\/'"]/;
    InitialDelimiters = /[#;=|*+\[\]{}]/;
    Whitespace = /\s+/;

    constructor(grammar) {
        this.grammar = grammar;
        this.next_char = 0;
    }

    *tokens() {
        while (this.next_char < this.grammar.length) {
            this.skip_whitespace();
            let start = this.next_char;
            let c = this.grammar[this.next_char];
            if (c.match(this.InitialDelimiters)) {
                this.next_char += 1;
                yield [Token_Symbol,
                       this.grammar.slice(start, this.next_char)];
            } else if (c == '<') {
                this.next_char += 1;
                this.skip_name();
                if (this.grammar[this.next_char] != '>')
                    throw new SyntaxError("missing terminating >");
                this.next_char += 1;     /* Skip over the > */
                yield [Token_Rule,
                       this.grammar.slice(start+1, this.next_char-1)];
            } else if (c == '"' || c == "'") {
                this.next_char = this.get_string(start);
                yield [Token_String, this.grammar.slice(start, n)];
            } else if (c == '/') {
                this.next_char += 1;
                if (this.next_char >= this.grammar.length)
                    throw new SyntaxError("unexpected end of input");
                if (this.grammar[this.next_char] == '/') {
                    this.next_char += 1;
                    this.skip_line(this.next_char+1);
                } else if (this.grammar[this.next_char] == '*') {
                    this.next_char += 1;
                    this.next_char = this.skip_comment();
                } else {
                    this.next_char += 1;
                    this.skip_weight(this.next_char);
                    yield ["weight",
                           this.grammar.slice(start, this.next_char)];
                }
            } else {
                this.skip_name();
                if (this.next_char > start)
                    yield [Token_String,
                           this.grammar.slice(start, this.next_char)];
            }
        }
    }

    skip_whitespace() {
        while (this.next_char < this.grammar.length &&
               this.grammar[this.next_char].match(this.Whitespace))
            this.next_char += 1;
    }

    skip_line() {
        while (this.next_char < this.grammar.length &&
               this.grammar[this.next_char] != '\n')
            this.next_char += 1;
    }

    skip_comment() {
        /* JSGF comments do not nest, according to spec */
        let state = 0;  /* 0 = skip, 1 = saw * */
        while (this.next_char < this.grammar.length) {
            if (state == 0) {
                if (this.grammar[this.next_char] == '*')
                    state = 1;
            } else if (state == 1) {
                if (this.grammar[this.next_char] != '/')
                    state = 0;
                else {
                    this.next_char += 1;
                    return;
                }
            }
            this.next_char += 1
        }
        throw new SyntaxError("unterminated comment");
    }

    skip_name() {
        while (this.next_char < this.grammar.length) {
            if (this.grammar[this.next_char].match(this.Delimiters) ||
                this.grammar[this.next_char].match(this.Whitespace))
                    return;
            this.next_char += 1;
        }
    }

    skip_weight() {
        while (this.next_char < this.grammar.length) {
            if (this.grammar[this.next_char] == '/')
                return;
            this.next_char += 1;
        }
    }
}

class _Production {

    constructor(is_public, name) {
        this.is_public = is_public;
        this.name = name;
        this.expr = new _Expr(Expr_Group, null);
        this.tos = this.expr;
        this.in_tag = false;
        this.in_weight = false;
        this.weight = 0;
        this.option_depth = 0;
        this.group_depth = 0;
    }

    tag_start() {
        this.in_tag = true;
    }

    tag_end() {
        this.in_tag = false;
    }

    group_start() {
        this.group_depth += 1;
        this.tos = this.tos.add_group();
    }

    group_end() {
        /* Should verify that tos is an "group" expression */
        if (this.group_depth <= 0)
            throw new SyntaxError("incorrectly nested group expression");
        this.group_depth -= 1;
        this.tos = this.tos.parent;
    }

    weight_toggle() {
        this.in_weight = !this.in_weight;
    }

    optional_start() {
        this.option_depth += 1;
        this.tos = this.tos.add_optional();
    }

    optional_end() {
        /* Should verify that tos is an "optional" expression */
        if (this.option_depth <= 0)
            throw new SyntaxError("incorrectly nested optional expression");
        this.option_depth -= 1;
        this.tos = this.tos.parent;
    }

    zero_or_more() {
        this.tos.set_count(0, -1);
    }

    one_or_more() {
        this.tos.set_count(1, -1);
    }

    alternative() {
        this.tos.add_alternative();
    }

    add_rule(rule_name) {
        this.tos.add_rule(rule_name);
    }

    add_string(s) {
        if (this.in_tag)
            this.tos.add_tag(s);
        else if (this.in_weight)
            this.tos.add_weight(s);
        else
            this.tos.add_string(s);
    }

    finalize() {
        delete this.tos;
        delete this.in_tag;
        delete this.in_weight;
        delete this.weight;
        delete this.option_depth;
        delete this.group_depth;
    }

    str() {
        let parts = [];
        if (this.is_public)
            parts.push("public");
        parts.push("<" + this.name + ">");
        parts.push("=");
        parts.push(this.expr.str());
        return parts.join(" ") + ";";
    }

    parse(rules, words) {
        /*
        console.debug("production parse: " + this.name);
        */
        return this.expr.parse(rules, words);
    }

    *referenced_rules() {
        yield* this.expr.referenced_rules();
    }

}

class _Expr {

    constructor(etype, parent, value) {
        this.etype = etype;
        this.parent = parent;
        this.min_count = 1;
        this.max_count = 1;
        this.tag = [];
        /* this.value is either a string (for strings and rules) or
         * a list of alternatives, each a list of expressions */
        switch (etype) {
          case Expr_String:
          case Expr_Rule:
              this.value = value
              break;
          case Expr_Group:
              this.value = [];
              this.add_alternative();
              break;
          case Expr_Optional:
              this.min_count = 0;
              this.value = [];
              this.add_alternative();
              break;
        }
    }

    add_alternative() {
        this.cur_list = [];
        this.value.push(this.cur_list);
    }

    set_count(lo, hi) {
        this.min_count = lo;
        this.max_count = hi;
    }

    add_expr(expr) {
        this.cur_list.push(expr);
    }

    add_rule(rule_name) {
        let expr = new _Expr(Expr_Rule, this, rule_name);
        this.add_expr(expr);
    }

    add_string(s) {
        let expr = new _Expr(Expr_String, this, s);
        this.add_expr(expr);
    }

    add_tag(s) {
        this.tag.push(s);
    }

    add_weight(s) {
        console.debug("weight: " + s);
    }

    add_group() {
        let expr = new _Expr(Expr_Group, this);
        this.add_expr(expr);
        return expr;
    }

    add_optional() {
        let expr = new _Expr(Expr_Optional, this);
        expr.set_count(0, 1);
        this.add_expr(expr);
        return expr;
    }

    str() {
        let parts = [];
        switch (this.etype) {
          case Expr_String:
            return this.value;
            break;  /* NOTREACHED */
          case Expr_Rule:
            return "<" + this.value + ">";
            break;  /* NOTREACHED */
          case Expr_Group:
            for (let exprs of this.value) {
                let expr_parts = [];
                for (let expr of exprs)
                    expr_parts.push(expr.str());
                parts.push(expr_parts.join(" "));
            }
            if (this.value.length > 1)
                return "( " + parts.join(" | ") + " )";
            else
                return parts.join(" | ");
            break;  /* NOTREACHED */
          case Expr_Optional:
            for (let exprs of this.value) {
                let expr_parts = [];
                for (let expr of exprs)
                    expr_parts.push(expr.str());
                parts.push(expr_parts.join(" "));
            }
            return "[ " + parts.join(" | ") + " ]";
            break;  /* NOTREACHED */
        }
    }

    parse(rules, words) {
        /*
        console.debug("parse " + this.etype + " (" + words.current_index() +
                      ") : " + words.current());
        */
        let start = words.current_index();
        switch (this.etype) {
          case Expr_String:
            if (words.current() == this.value) {
                words.consume();
                return { etype: Expr_String, value: this.value };
            } else
                throw new RangeError("no match with word: " + this.value);
            break;
          case Expr_Rule:
            let rule = rules[this.value];
            return { etype: Expr_Rule, ename: rule.name,
                     value: rule.parse(rules, words) };
            break;
          case Expr_Group:
          case Expr_Optional:
            for (let alt of this.value) {
                let value_list = [];
                try {
                    words.set_index(start);
                    for (let expr of alt)
                        value_list.push(expr.parse(rules, words));
                    value_list.etype = this.etype;
                    /*
                    let sa = alt.map(e => e.str());
                    console.debug("match list: " + sa.join(" "));
                    */
                    return value_list;
                } catch(err) {
                    /*
                    let sa = alt.map(e => e.str());
                    console.debug("no match with list: " + sa.join(" "));
                    */
                }
            }
            /* Fell through, so no match */
            words.set_index(start);
            if (this.min_count >= 1)
                throw new RangeError("no match with group");
            break;
        }
    }

    *referenced_rules() {
        switch (this.etype) {
          case Expr_String:
              /* No rules referenced here */
              break;
          case Expr_Rule:
              yield this.value;
              break;
          case Expr_Group:
          case Expr_Optional:
            for (let alt of this.value)
                for (let expr of alt)
                    yield* expr.referenced_rules();
            break;
        }
    }

}

class Words {

    constructor(input) {
        this.input = input;
        this.words = input.toLowerCase().split(/\s+/);
        this.n = 0;
    }

    current() {
        return this.words[this.n];
    }

    peek(n) {
        return this.words[n];
    }

    consume() {
        this.n += 1;
    }

    current_index() {
        return this.n;
    }

    set_index(n) {
        this.n = n;
    }

}
