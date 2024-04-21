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
        this._read_productions();
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

    _read_productions() {
        let t = this._next_token();
        this.productions = {}
        while (t[0] != Token_EOF) {
            /* t is already set to first token of this rule */
            let is_public = false;
            if (t[0] == Token_String && t[1] == "public") {
                is_public = true;
                t = this._next_token();
            }
            if (t[0] != Token_Rule)
                throw new SyntaxError("bad rule [1]");
            let p = new _Production(is_public, t[1]);
            this.productions[t[1]] = p;
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
    }

    str_header() {
        let parts = ["#JSGF", this.jsgf_version];
        if (this.jsgf_encoding != null)
            parts.push(this.jsgf_encoding);
        if (this.jsgf_locale != null)
            parts.push(this.jsgf_locale);
        return parts.join(" ") + ";";
    }

    str_grammar() {
        return "grammar " + this.grammar_name + ";";
    }

    str_productions() {
        let rule_names = Object.keys(this.productions).sort();
        let production_strs = [];
        for (let name of rule_names)
            production_strs.push(this.productions[name].str());
        return production_strs.join("\n");
    }

    parse(input) {
        /* Return parse tree or throw exception */
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
        console.log("weight: " + s);
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

}


test_grammar = `#JSGF V1.0;

grammar bridge;

public <contract> = <level> <suit> [ <doubt> ] [ by ] <seat>;
<level> = one | two | three | four | five | six | seven;
<suit> = <spades> | <hearts> | <diamonds> | <club> | <notrump>;
<spades> = spades | spade;
<hearts> = hearts | heart;
<diamondss> = diamondss | diamonds;
<clubs> = clubs | club;
<notrump> = no [ trump ];
<doubt> = <doubled> | <redoubled>;
<doubled> = doubled | double;
<redoubled> = redoubled | redouble;
<seat> = north | east | south | west;

public <result> = <sign> <count>;
<sign> = <made> | <down>;
<made> = made | making;
<down> = down | set;
<count> = one | two | three | four | five | six | seven |
          eight | nine | ten | eleven | twelve | thirteen;`

// let parser = new JSGFParser(test_grammar);
// console.log(parser);
