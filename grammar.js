/* vim: set ai et sw=4 sts=4: */

BridgeScoreGrammar = `#JSGF V1.0;

grammar bridge;

public <contract> = <level> <suit> [ <doubt> ] [ by ] <seat>;

<level> = <1> | <2> | <3> | <4> | <5> | <6> | <7>;

<suit> = <spades> | <hearts> | <diamonds> | <clubs> | <notrump>;
<spades> = spades | spade | space;
<hearts> = hearts | heart;
<diamonds> = diamonds | diamond;
<clubs> = clubs | club;
<notrump> = no [ trump ];

<doubt> = <doubled> | <redoubled>;
<doubled> = doubled | double;
<redoubled> = redoubled | redouble;

<seat> = <north> | <east> | <south> | <west>;
<north> = north;
<east> = east;
<south> = south | self;
<west> = west;

public <result> = <sign> <count>;
<sign> = <made> | <down>;
<made> = made | making;
<down> = down | set;
<count> = <1> | <2> | <3> | <4> | <5> | <6> | <7>
          <8> | <9> | <10> | <11> | <12> | <13>;

<1> = 1 | one;
<2> = 2 | two | to;
<3> = 3 | three;
<4> = 4 | four | for;
<5> = 5 | five;
<6> = 6 | six;
<7> = 7 | seven;
<8> = 8 | eight | ate;
<9> = 9 | nine;
<10> = 10 | ten;
<11> = 11 | eleven;
<12> = 12 | twelve;
<13> = 13 | thirteen;`


function bridge_grammar_test() {
    let parser = new JSGFParser(BridgeScoreGrammar);
    console.log(parser);
    console.log(parser.str_grammar());
    console.log(parser.parse("4 Spades by West"));
    console.log(parser.parse("four diamonds redoubled by west"));
    console.log(parser.parse("down 4"));
}

function speech_extract(text) {
    let pt = SpeechParser.parse(text);
    /*
    console.debug(pt);
    */
    /* Successful return value is one of the public rules */
    if (pt.ename == "contract")
        return ["contract", _extract_contract(pt)];
    else if (pt.ename == "result")
        return ["result", _extract_result(pt)];
    else
        throw new Error("unknown speech rule: " + pt.ename);
}

function _extract_contract(pt) {
    /* 
     * pt.value should be an array of 5 elements:
     *   0: level,
     *   1: suit,
     *   2: double or redouble (null if none),
     *   3: the word "by" (null if missing), and
     *   4: seat.
     * this should match the <contract> rule in the grammar.
     */
    let contract = pt.value[0].value[0].ename + pt.value[1].value[0].ename[0];
    if (pt.value[2] != undefined) {
        /* Extra [0] needed because double/redouble is optional */
        if (pt.value[2][0].value[0].ename == "doubled")
            contract += "x";
        else
            contract += "xx";
    }
    /* skip "by" */
    contract += pt.value[4].value[0].ename[0];
    return contract;
}

function _extract_result(pt) {
    /* 
     * pt.value should be an array of 2 elements:
     *   0: made or down,
     *   1: number of tricks,
     * this should match the <rule> rule in the grammar.
     */
    let result = pt.value[0].value[0].ename == "down" ? "-" : "+";
    result += pt.value[1].value[0].ename;
    return result;
}
