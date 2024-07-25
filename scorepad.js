/* vim: set ai et sw=4 sts=4: */

ScoreSystem = "Duplicate";   /* One of Duplicate, Chicago, Rubber */
SuitName = {
    N: "N",
    S: "<tspan class=\"suit-black\">&spades;</tspan>",
    H: "<tspan class=\"suit-red\">&hearts;</tspan>",
    D: "<tspan class=\"suit-red\">&diams;</tspan>",
    C: "<tspan class=\"suit-black\">&clubs;</tspan>",
}
NextSeat = {
    north: "east",
    east: "south",
    south: "west",
    west: "north",
}
PrevSeat = {}
for (let s in NextSeat)
    PrevSeat[NextSeat[s]] = s;
SeatAbbr = {
    N: "north",
    E: "east",
    S: "south",
    W: "west",
}
SeatName = {
    N: "North",
    E: "East",
    S: "South",
    W: "West",
}
SeatSide = {
    north: "ns",
    east: "ew",
    south: "ns",
    west: "ew",
    N: "ns",
    E: "ew",
    S: "ns",
    W: "ew",
}
SideName = {
    ew: "East-West",
    ns: "North-South",
}
OtherSide = {
    ew: "ns",
    ns: "ew",
}
NameConnector = " &ndash; ";

Matches = [];
CurrentMatch = -1;
CurrentMatchResults = null;     /* Used when displaying prev matches */
MatchResults = [];
TotalScore = { ns:0, ew:0 };
Vulnerability = { ns: false, ew: false }
BelowRows = [];
NextRow = { ns: 0, ew: 0 };

/* Contract is of form "level suit [double] [redouble] seat" */
REContract = /([1234567][NSHDC]X{0,2})([NESW])/;
REContractDetails = /([1234567])([NSHDC])(X{0,2})([NESW])/;
/* Result is of form "[+-]#" */
REResult = /([-+]?)(\d+)/;

/* Speech recognition stuff */
recognition = null;
speech_parser = null;


/*
 * Miscellaneous utility functions
 */

function set_vulnerability(side, onoff) {
    let players = document.getElementsByClassName(side + "-bg");
    for (let player of players) {
        if (onoff) {
            player.classList.remove("nonvul");
            player.classList.add("vulnerable");
        } else {
            player.classList.remove("vulnerable");
            player.classList.add("nonvul");
        }
    }
    Vulnerability[side] = onoff;
}

function next_hand() {
    /* Show dealer for next hand */
    let dealers = document.getElementsByClassName("dealing");
    if (dealers.length != 1) {
        alert("Something is horribly wrong (next_hand)");
        return;
    }
    let de = dealers[0];
    let cur_seat = de.getAttribute("seat");
    let next_seat = NextSeat[cur_seat];
    dealer_show(next_seat);
    /* Clear contract and result fields */
    contract_clear();
    contract_disable(false);
    result_clear();
    result_disable(true);
}

function part_scores() {
    let part_scores = {ns:0, ew:0};
    for (let hand of MatchResults) {
        part_scores[hand.winning_side] += hand.score_below;
        if (part_scores[hand.winning_side] >= 100)
            part_scores = {ns:0, ew:0};
    }
    return part_scores;
}

function part_score(side) {
    return part_scores()[side];
}

/*
 * Dealer functions
 */

function dealer_update(ev) {
    /* this = element triggering event */
    dealer_show(this.getAttribute("seat"));
}

function dealer_show(seat) {
    if (seat != null) {
        for (let de of document.getElementsByClassName("dealing"))
            de.classList.remove("dealing");
        document.getElementById(seat + "-dealer").classList.add("dealing");
    }
    /* Clear any displayed contracts and show part scores */
    let labels = { "north":"", "east":"", "south":"", "west":"" };
    if (ScoreSystem != "Duplicate") {
        /* Duplicate scoring does not accumulate below-line points */
        let ps = part_scores();
        if (ps.ns > 0) {
            labels["north"] = ps.ns;
            labels["south"] = ps.ns;
        }
        if (ps.ew > 0) {
            labels["east"] = ps.ew;
            labels["west"] = ps.ew;
        }
    }
    for (let s in labels)
        document.getElementById(s + "-contract").innerHTML = labels[s];
    /* Set vulnerability.
     * For Chicago and duplicate scoring, vulnerability
     * depends on number of hands dealt */
    if (ScoreSystem == "Duplicate" || ScoreSystem == "Chicago") {
        let us = SeatSide[seat];
        let them = OtherSide[us];
        switch (MatchResults.length % 4) {
            case 0:
                set_vulnerability(us, false);
                set_vulnerability(them, false);
                break;
            case 1:
            case 2:
                set_vulnerability(us, true);
                set_vulnerability(them, false);
                break;
            case 3:
                set_vulnerability(us, true);
                set_vulnerability(them, true);
                break;
        }
    }
}

/*
 * Scorepad functions
 */

function scorepad_clear_section(id) {
    document.getElementById(id).innerHTML = "";
}

function scorepad_clear() {
    scorepad_clear_section("ns-above");
    scorepad_clear_section("ns-below");
    scorepad_clear_section("ew-above");
    scorepad_clear_section("ew-below");
    MatchResults = [];
    scorepad_show_match_totals();
    set_vulnerability("ns", false);
    set_vulnerability("ew", false);
    BelowRows = [];
    NextRow = { ns: 0, ew: 0 };
}

function sp_make_side_row(side) {
    let table = document.getElementById(side+"-below");
    let tr = document.createElement("tr");
    table.appendChild(tr)
    let td_contract = document.createElement("td");
    td_contract.classList.add("score-contract");
    td_contract.innerHTML = "&nbsp;";
    tr.appendChild(td_contract);
    let td_value = document.createElement("td");
    td_value.classList.add("score-value");
    td_value.innerHTML = "&nbsp;";
    tr.appendChild(td_value);
    return tr;
}

function sp_add_below_score(side, contract, value, made_game, title) {
    let state = { next_row:{ ...NextRow }, side:side };
    let want_row = NextRow[side];
    let row_pair;
    if (want_row >= BelowRows.length) {
        row_pair = { ns: sp_make_side_row("ns"), ew: sp_make_side_row("ew") };
        BelowRows.push(row_pair);
        state.new_row_pair = true
    } else {
        row_pair = BelowRows[want_row];
        state.new_row_pair = false;
    }
    state.row_pair = row_pair;
    if (!made_game)
        NextRow[side] += 1;
    else {
        row_pair.ns.classList.add("score-game");
        row_pair.ew.classList.add("score-game");
        NextRow.ns = want_row + 1;
        NextRow.ew = want_row + 1;
    }
    let tr = BelowRows[want_row][side];
    tr.children[0].innerHTML = contract;
    tr.children[1].innerHTML = value;
    tr.children[1].setAttribute("title", title);
    return state;
}

function sp_undo_below_score(state) {
    if (state.new_row_pair) {
        BelowRows.pop();
        state.row_pair.ns.remove();
        state.row_pair.ew.remove();
    } else {
        state.row_pair.ns.classList.remove("score-game");
        state.row_pair.ew.classList.remove("score-game");
        let tr = state.row_pair[state.side];
        tr.children[0].innerHTML = "";
        tr.children[1].innerHTML = "";
        tr.children[1].removeAttribute("title");
    }
    NextRow = state.next_row;
}

function sp_add_above_score(side, contract, value, title) {
    let table = document.getElementById(side+"-above")
    let tr = document.createElement("tr");
    table.insertBefore(tr, table.firstChild)
    let td_contract = document.createElement("td");
    td_contract.classList.add("score-contract");
    td_contract.innerHTML = contract;
    tr.appendChild(td_contract);
    let td_value = document.createElement("td");
    td_value.classList.add("score-value");
    td_value.innerHTML = value;
    td_value.setAttribute("title", title);
    tr.appendChild(td_value);
    return { row:tr };
}

function sp_undo_above_score(state) {
    state.row.remove();
}

function scorepad_update(contract_info, result, redisplay) {
    let level = parseInt(contract_info.level);
    let suit = contract_info.suit;
    /* 0:undoubled 1:doubled 2:redoubled */
    let doubled = contract_info.doubled.length;
    let seat = contract_info.seat;
    let side = seat.match(/[EW]/) ? "ew" : "ns";
    let tricks = parseInt(result.value);
    if (result.sign == "-")
        tricks = -tricks;
    else if (tricks < level || tricks > 7)
        throw new RangeError("too few tricks for contract");
    let vulnerable = Vulnerability[side]
    let deal_index = MatchResults.length;
    let label = contract_label(deal_index, contract_info, result)
    let desc = level + " " + SuitName[suit];
    if (doubled == 1)
        desc += " doubled";
    else if (doubled == 2)
        desc += " redoubled";
    desc += " by " + SeatName[seat];
    if (vulnerable) {
        label += " (vul)";
        desc += ", vulnerable,";
    } else {
        label += " (nonvul)";
        desc += ", not vulnerable,";
    }
    /* Add result to history */
    let hand_result = {deal_index: deal_index,
                       contract_info: contract_info,
                       result: result};
    /* Check if declaring side is vulnerable */
    /* Compute score and potential bonus */
    let contract = 0;
    let overtricks = 0
    let undertricks = 0;
    let insult = 0;
    let game_bonus = 0;
    let slam_bonus = 0;
    let end_of_match = false;
    if (ScoreSystem == "Duplicate" || ScoreSystem == "Chicago")
        end_of_match = deal_index % 4 == 3;
    let num_over = tricks - level;
    if (tricks > 0) {
        /* Contract and overtricks */
        if (suit == "N") {
            contract = 40 + (level - 1) * 30;
            overtricks = num_over * 30;
        } else if (suit == "S" || suit == "H") {
            contract = level * 30;
            overtricks = num_over * 30;
        } else if (suit == "D" || suit == "C") {
            contract = level * 20;
            overtricks = num_over * 20;
        } else {
            throw new RangeError("Unrecognized suit abbreviation: " + suit);
        }
        if (doubled == 1) {         /* doubled */
            contract = contract * 2;
            overtricks = num_over * (vulnerable ? 200 : 100);
            insult = 50;
        } else if (doubled == 2) {  /* redoubled */
            contract = contract * 4;
            overtricks = num_over * (vulnerable ? 400 : 200);
            insult = 100;
        }
        /* Slam bonus */
        if (level == 6)
            slam_bonus = vulnerable ? 750 : 500;
        else if (level == 7)
            slam_bonus = vulnerable ? 1500 : 1000;
        /* Game bonus */
        let draw_line = false;
        if (ScoreSystem == "Duplicate") {
            /* vulnerable game: 500, non-vul game: 300, part score: 50 */
            if (contract >= 100)
                game_bonus = vulnerable ? 500 : 300;
            else
                game_bonus = 50;
        } else if (ScoreSystem == "Chicago") {
            /* vulnerable game: 500, non-vul game: 300,
             * part score: 50, but only on fourth deal */
            let game_score = contract + part_score(side);
            if (game_score >= 100) {
                game_bonus = vulnerable ? 500 : 300;
                /* Part score wiped out for both sides */
                draw_line = true;
            } else if (end_of_match) {
                game_bonus = 50;
            }
        } else if (ScoreSystem == "Rubber") {
            let game_score = contract + part_score(side);
            if (game_score >= 100) {
                if (vulnerable) {
                    /* Rubber ends */
                    if (Vulnerability[OtherSide[side]])
                        game_bonus = 500;
                    else
                        game_bonus = 700;
                    end_of_match = true;
                } else {
                    set_vulnerability(side, true);
                }
                draw_line = true;
            }
        } else {
            throw new RangeError("Unrecognized score style: " + ScoreSystem);
        }
        let score_above = overtricks + insult + slam_bonus + game_bonus;
        let score_total = contract + score_above;
        /* Show score and breakdown in alert message */
        let breakdown = ["contract: " + contract];
        if (overtricks > 0)
            breakdown.push("overtricks: " + overtricks);
        if (insult > 0)
            breakdown.push("insult: " + insult);
        if (slam_bonus > 0)
            breakdown.push("slam: " + slam_bonus);
        if (game_bonus > 0)
            breakdown.push("game: " + game_bonus);
        let breakdown_msg = breakdown.join(", ")
        let msg = desc + " making " + tricks + "<br/>" +
                  SideName[side] + " scores " + score_total + "<br/>" +
                  breakdown_msg;
        if (redisplay)
            sp_contract_made(hand_result, side, contract, score_above,
                             score_total, label, breakdown_msg, draw_line,
                             end_of_match, true);
        else
            confirm_show(msg,
                         sp_contract_made.bind(null, hand_result, side,
                                               contract, score_above,
                                               score_total, label,
                                               breakdown_msg, draw_line,
                                               end_of_match, false), null);
    } else {
        /* Compute undertricks score */
        if (vulnerable) {
            if (doubled == 0) {
                undertricks = tricks * 100;
            } else if (doubled == 1) {
                /* 300 for each trick -4 +
                 * 300 for tricks -2 and -3 +
                 * 200 for tricks -1 */
                if (tricks <= -2) {
                    undertricks = (tricks + 1) * 300 - 200;
                } else {
                    undertricks = -200;
                }
            } else if (doubles == 2) {
                /* 600 for each trick -4 +
                 * 600 for tricks -2 and -3 +
                 * 400 for tricks -1 */
                if (tricks <= -2) {
                    undertricks = (tricks + 1) * 600 - 400;
                } else {
                    undertricks = -400;
                }
            }
        } else {
            if (doubled == 0) {
                undertricks = tricks * 50;
            } else if (doubled == 1) {
                /* 300 for each trick -4 +
                 * 200 for tricks -2 and -3 +
                 * 100 for tricks -1 */
                if (tricks <= -4) {
                    undertricks = (tricks + 3) * 300 - 2*200 - 100;
                } else if (tricks <= -2) {
                    undertricks = (tricks + 1) * 200 - 100;
                } else {
                    undertricks = -100;
                }
            } else if (doubles == 2) {
                /* 600 for each trick -4 +
                 * 400 for tricks -2 and -3 +
                 * 200 for tricks -1 */
                if (tricks <= -4) {
                    undertricks = (tricks + 3) * 600 - 2*400 - 200;
                } else if (tricks <= -2) {
                    undertricks = (tricks + 1) * 400 - 200;
                } else {
                    undertricks = -200;
                }
            }
        }
        undertricks = -undertricks;
        let other_side = OtherSide[side];
        /* Show score and ask user if correct */
        let msg = desc + " down " + (-tricks) + "<br/>" +
                  SideName[other_side] + " scores " + undertricks;
        let breakdown_msg = "undertricks: " + undertricks;
        if (redisplay)
            sp_contract_down(hand_result, other_side, undertricks, label,
                             breakdown_msg, end_of_match, true);
        else
            confirm_show(msg,
                         sp_contract_down.bind(null, hand_result, other_side,
                                               undertricks, label,
                                               breakdown_msg, end_of_match,
                                               false), null);
    }
}

function sp_contract_made(hand_result, side, contract, score_above, score_total,
                          label, breakdown_msg, draw_line,
                          end_of_match, redisplay) {
    /* Display on score pad */
    hand_result.winning_side = side;
    hand_result.score_total = score_total;
    hand_result.score_above = score_above;
    hand_result.score_below = contract;
    hand_result.state_score_above = null;
    hand_result.state_score_below = null;
    if (ScoreSystem == "Duplicate") {
        hand_result.state_score_below = sp_add_below_score(side, label,
                                                           score_total, false,
                                                           breakdown_msg);
    } else {
        hand_result.state_score_below = sp_add_below_score(side, label,
                                                           contract, draw_line,
                                                           breakdown_msg);
        if (score_above > 0) {
            hand_result.state_score_above = sp_add_above_score(side, label,
                                                               score_above,
                                                               breakdown_msg);
        }
    }
    MatchResults.push(hand_result);
    scorepad_show_match_totals();
    if (!redisplay) {
        if (end_of_match)
            match_end();
        else
            next_hand();
    }
}

function sp_contract_down(hand_result, other_side, undertricks, label,
                          breakdown_msg, end_of_match, redisplay) {
    /* Display on score pad */
    hand_result.winning_side = other_side;
    hand_result.score_total = undertricks;
    hand_result.score_above = undertricks;
    hand_result.score_below = 0;
    hand_result.state_score_below = null;
    if (ScoreSystem == "Duplicate") {
        hand_result.state_score_below = sp_add_below_score(other_side, label,
                                                           undertricks, false,
                                                           breakdown_msg);
    } else {
        hand_result.state_score_above = sp_add_above_score(other_side, label,
                                                           undertricks,
                                                           breakdown_msg);
    }
    MatchResults.push(hand_result);
    scorepad_show_match_totals();
    if (!redisplay) {
        if (end_of_match)
            match_end();
        else
            next_hand();
    }
}

function scorepad_show_match_totals() {
    let match_total = { ns:0, ew:0 };
    for (let hand of MatchResults)
        match_total[hand.winning_side] += hand.score_total;
    document.getElementById("score-ns-match").innerHTML = match_total.ns;
    document.getElementById("score-ew-match").innerHTML = match_total.ew;
}

function scorepad_show_accumulated_totals() {
    document.getElementById("score-ns-total").innerHTML = TotalScore.ns;
    document.getElementById("score-ew-total").innerHTML = TotalScore.ew;
}

/*
 * End of match functions
 */

function match_end() {
    let final = {ns:0, ew:0};
    let msg;
    for (let hand of MatchResults)
        final[hand.winning_side] += hand.score_total;
    if (final.ns > final.ew) {
        msg = SideName["ns"] + " wins:" + final.ns + "-" + final.ew;
    } else if (final.ns < final.ew) {
        msg = SideName["ew"] + " wins:" + final.ew + "-" + final.ns;
    } else {
        msg = "It's a tie";
    }
    TotalScore.ns += final.ns;
    TotalScore.ew += final.ew;
    eom_show(msg);
}

function eom_show(msg) {
    scorepad_show_accumulated_totals();
    document.getElementById("eom-text").innerHTML = msg;
    document.getElementById("eom-dialog").show();
}

function eom_close(ev) {
    ev.preventDefault();
    document.getElementById("eom-dialog").close();
    Matches.push(MatchResults);
    scorepad_clear();
    next_hand();
    match_update();
}

function match_update() {
    let mge = document.getElementById("match-group");
    mge.innerHTML = "";
    for (let i = 0; i < Matches.length; i++) {
        let opt = document.createElement("option");
        opt.value = i;
        opt.text = (i + 1);
        mge.appendChild(opt);
    }
    let opt = document.createElement("option");
    opt.value = -1;
    opt.selected = true;
    opt.text = "Current";
    mge.appendChild(opt);
}

function match_update_selected(ev) {
    let selected_match = parseInt(this.value);
    if (selected_match == CurrentMatch)
        return;
    if (CurrentMatch == -1)
        CurrentMatchResults = MatchResults;
    CurrentMatch = selected_match;
    if (selected_match == -1) {
        /* Current match */
        match_redisplay(CurrentMatchResults);
        contract_disable(false);
    } else {
        /* Previous match */
        contract_disable(true);
        match_redisplay(Matches[selected_match]);
    }
}

function match_redisplay(results) {
    scorepad_clear();
    for (let hand of results)
        scorepad_update(hand.contract_info, hand.result, true);
}

/*
 * Contract functions
 */

function contract_update(ev) {
    let level = document.getElementById("contract-level");
    let suit = document.getElementById("contract-suit");
    let seat = document.getElementById("contract-seat");
    let doubled = document.getElementById("contract-doubled");
    let ready = true;
    if (level.value == "none") {
        level.classList.add("missing-value");
        ready = false;
    } else
        level.classList.remove("missing-value");
    if (suit.value == "none") {
        suit.classList.add("missing-value");
        ready = false;
    } else
        suit.classList.remove("missing-value");
    if (seat.value == "none") {
        seat.classList.add("missing-value");
        ready = false;
    } else
        seat.classList.remove("missing-value");
    if (doubled.value == "none") {
        doubled.classList.add("missing-value");
        ready = false;
    } else
        doubled.classList.remove("missing-value");
    if (ready)
        contract_show(contract_string());
}

function contract_string() {
    let level = document.getElementById("contract-level").value;
    let suit = document.getElementById("contract-suit").value;
    let seat = document.getElementById("contract-seat").value;
    let doubled = document.getElementById("contract-doubled").value;
    let s = [level, suit, doubled, seat].join(' ');
    return s;
}

function contract_show(contract) {
    let contract_info = contract_parse(contract);
    if (contract_info == null) {
        /* console.log(contract); */
        alert_show("That is not a valid contract.", null);
        return;
    }
    document.getElementById("contract-level").value = contract_info.level;
    document.getElementById("contract-suit").value = contract_info.suit;
    document.getElementById("contract-seat").value = contract_info.seat;
    document.getElementById("contract-doubled").value = contract_info.doubled;
    /* Display final contract on board */
    let seat = SeatAbbr[contract_info.seat];
    for (let s in NextSeat) {
        let ce = document.getElementById(s + "-contract");
        ce.innerHTML = s == seat ? contract_html(contract_info, false) : "";
    }
    result_disable(false);
}

function contract_parse(s) {
    let ns = s.replace(/\s/g, '').toUpperCase();
    let parts = ns.match(REContractDetails);
    if (parts == null)
        return null;
    return { whole: parts[0],
             level: parts[1],
             suit: parts[2],
             doubled: parts[3].toLowerCase(),
             seat: parts[4] }
}

function contract_html(contract, include_seat) {
    let s = [contract.level,
             SuitName[contract.suit],
             contract.doubled];
    if (include_seat)
        s.push(contract.seat);
    return s.join("");
}

function contract_label(deal_index, contract_info, result_info) {
    return (deal_index+1) + ": " + contract_html(contract_info, true) +
           result_html(result_info);
}

function contract_clear(onoff) {
    optionbox_reset("contract-level");
    optionbox_reset("contract-suit");
    optionbox_reset("contract-seat");
    optionbox_reset("contract-doubled");
}

function contract_disable(onoff) {
    document.getElementById("contract-level").disabled = onoff;
    document.getElementById("contract-suit").disabled = onoff;
    document.getElementById("contract-seat").disabled = onoff;
    document.getElementById("contract-doubled").disabled = onoff;
}

function contract_is_game(contract_info) {
    if (contract_info.suit == 'S' || contract_info.suit == 'H')
        return contract_info.level >= 4;
    else if (contract_info.suit == 'D' || contract_info.suit == 'C')
        return contract_info.level >= 5;
    else    /* Must be no trump */
        return contract_info.level >= 3;
}

/*
 * Result functions
 */
function result_parse(s) {
    let ns = s.replace(/\s/g, '').toUpperCase();
    /* Contract is of form (level suit [double] [redouble] seat) */
    let parts = ns.match(REResult);
    if (parts == null)
        return null;
    if (parts[1] == "")
        parts[1] = "+";
    return { whole: parts[0],
             sign: parts[1],
             value: parts[2] }
}

function result_html(result_info) {
    return result_info.sign + result_info.value;
}

function result_update(ev) {
    let made = document.getElementById("result-made");
    let tricks = document.getElementById("result-tricks");
    let ready = true;
    if (made.value == "none") {
        made.classList.add("missing-value");
        ready = false;
    } else
        made.classList.remove("missing-value");
    if (tricks.value == "none") {
        tricks.classList.add("missing-value");
        ready = false;
    } else
        tricks.classList.remove("missing-value");
    if (ready)
        result_show(made.value + tricks.value);
}

function result_show(result) {
    let result_info = result_parse(result);
    if (result_info == null) {
        alert_show("That is not a valid result.", null);
        return;
    }
    /* Update score pad */
    let cs = contract_string();
    try {
        scorepad_update(contract_parse(cs), result_info, false);
    } catch (e) {
        if (e instanceof RangeError) {
            alert_show(e.message, null);
            return;
        } else {
            throw e;
        }
    }
}

function result_clear() {
    optionbox_reset("result-made");
    select_reset("result-tricks");
}

function result_disable(onoff) {
    document.getElementById("result-made").disabled = onoff;
    document.getElementById("result-tricks").disabled = onoff;
}

/*
 * Undo functions
 */

function undo_click(ev) {
    if (MatchResults.length == 0)
        alert_show("There are no results to undo", null);
    else
        confirm_show("Remove last contract score?", undo, null);
}

function undo() {
    /* Remove last result */
    let last_result = MatchResults.pop();
    if (last_result.state_score_above != null)
        sp_undo_above_score(last_result.state_score_above);
    if (last_result.state_score_below != null)
        sp_undo_below_score(last_result.state_score_below);
    /* Recompute vulnerability if necessary */
    if (ScoreSystem == "Rubber") {
        set_vulnerability("ns", false);
        set_vulnerability("ew", false);
        let below_scores = {ns:0, ew:0};
        for (let hand of MatchResults) {
            below_scores[hand.winning_side] += hand.score_below;
            if (below_scores[hand.winning_side] >= 100) {
                below_scores = {ns:0, ew:0};
                set_vulnerability(hand.winning_side, true);
            }
        }
    }
    scorepad_show_match_totals();
    /* Show dealer for last hand */
    let dealers = document.getElementsByClassName("dealing");
    if (dealers.length != 1) {
        alert("Something is horribly wrong (undo)");
        return;
    }
    let de = dealers[0];
    let cur_seat = de.getAttribute("seat");
    let prev_seat = PrevSeat[cur_seat];
    dealer_show(prev_seat);
}

/*
 * Clear scores functions
 */

function clear_click(ev) {
    confirm_show("Clear all scores, including totals?", clear_all, null);
}

function clear_all() {
    scorepad_clear();
    TotalScore.ns = 0;
    TotalScore.ew = 0;
    scorepad_show_accumulated_totals();
    dealer_show(null);
}

/*
 * Stats functions
 */

function stats_click(ev) {
    let stbe = document.getElementById("stats-table-body");
    stbe.innerHTML = "";
    let stats = stats_collect();
    stats_add_row(stbe, "Contracts", "",
                  stats.contracts_bid.ns, stats.contracts_made.ns,
                  stats.contracts_bid.ew, stats.contracts_made.ew);
    stats_add_row(stbe, "Games", "",
                  stats.games_bid.ns, stats.games_made.ns,
                  stats.games_bid.ew, stats.games_made.ew);
    stats_add_row(stbe, "Part Scores", "stats-separator",
                  stats.part_scores_bid.ns, stats.part_scores_made.ns,
                  stats.part_scores_bid.ew, stats.part_scores_made.ew);
    stats_add_row(stbe, "Small Slams", "",
                  stats.small_slams_bid.ns, stats.small_slams_made.ns,
                  stats.small_slams_bid.ew, stats.small_slams_made.ew);
    stats_add_row(stbe, "Grand Slams", "",
                  stats.grand_slams_bid.ns, stats.grand_slams_made.ns,
                  stats.grand_slams_bid.ew, stats.grand_slams_made.ew);
    let sstbe = document.getElementById("stats-seat-table-body");
    stats_seat_add_row(sstbe, "Contracts", "",
                  stats.seat_bid.N, stats.seat_made.N,
                  stats.seat_bid.S, stats.seat_made.S,
                  stats.seat_bid.E, stats.seat_made.E,
                  stats.seat_bid.W, stats.seat_made.W);
    document.getElementById("stats-dialog").showModal();
}

function stats_close(ev) {
    ev.preventDefault();
    document.getElementById("stats-dialog").close();
}

function stats_collect() {
    let stats = {
        contracts_bid: { ns:0, ew:0 },
        contracts_made: { ns:0, ew:0 },
        games_bid: { ns:0, ew:0 },
        games_made: { ns:0, ew:0 },
        part_scores_bid: { ns:0, ew:0 },
        part_scores_made: { ns:0, ew:0 },
        small_slams_bid: { ns:0, ew:0 },
        small_slams_made: { ns:0, ew:0 },
        grand_slams_bid: { ns:0, ew:0 },
        grand_slams_made: { ns:0, ew:0 },
        seat_bid: { N:0, S:0, E:0, W:0 },
        seat_made: { N:0, S:0, E:0, W:0 },
    }
    for (let match of Matches)
        stats_collect_match(stats, match);
    stats_collect_match(stats, MatchResults);
    return stats;
}

function stats_collect_match(stats, match) {
    for (let hand of match) {
        let side = SeatSide[hand.contract_info.seat];
        let made = (side == hand.winning_side);
        stats.contracts_bid[side] += 1;
        stats.seat_bid[hand.contract_info.seat] += 1;
        if (made) {
            stats.contracts_made[side] += 1;
            stats.seat_made[hand.contract_info.seat] += 1;
        }
        if (contract_is_game(hand.contract_info)) {
            stats.games_bid[side] += 1;
            if (made)
                stats.games_made[side] += 1;
        } else {
            stats.part_scores_bid[side] += 1;
            if (made)
                stats.part_scores_made[side] += 1;
        }
        if (hand.contract_info.level == 6) {
            stats.small_slams_bid[side] += 1;
            if (made)
                stats.small_slams_made[side] += 1;
        }
        if (hand.contract_info.level == 7) {
            stats.grand_slams_bid[side] += 1;
            if (made)
                stats.grand_slams_made[side] += 1;
        }
    }
}

function stats_add_row(tbe, label, klass, ns_bid, ns_made, ew_bid, ew_made) {
    let tr = document.createElement("tr");
    tbe.appendChild(tr);
    _stats_add_label(tr, label, klass);
    _stats_add_value(tr, klass, ns_made, ns_bid);
    _stats_add_value(tr, klass, ew_made, ew_bid);
}

function _stats_add_label(tr, label, klass) {
    let le = document.createElement("th");
    le.classList.add("stats-label");
    if (klass)
        le.classList.add(klass);
    le.innerHTML = label;
    tr.appendChild(le);
}

function _stats_add_value(tr, klass, bid, made) {
    let e = document.createElement("td");
    e.classList.add("stats-value");
    if (klass)
        e.classList.add(klass);
    e.innerHTML = made + '/' + bid;
    tr.appendChild(e);
}

function stats_seat_add_row(tbe, label, klass, n_bid, n_made, s_bid, s_made,
                            e_bid, e_made, w_bid, w_made) {
    let tr = document.createElement("tr");
    tbe.appendChild(tr);
    _stats_add_label(tr, label, klass);
    _stats_add_value(tr, klass, n_made, n_bid);
    _stats_add_value(tr, klass, s_made, s_bid);
    _stats_add_value(tr, klass, e_made, e_bid);
    _stats_add_value(tr, klass, w_made, w_bid);
}

/*
 * Edit name functions
 */

function edit_name(ev) {
    /* this = element triggering event */
    let seat = this.getAttribute("seat");
    edit_name_show(seat);
}

function edit_name_show(seat) {
    let name = document.getElementById(seat + "-name").innerHTML;
    if (name.startsWith(NameConnector))
        name = name.slice(NameConnector.length);
    document.getElementById("edit-name-input").value = name;
    let d = document.getElementById("edit-name-dialog");
    d.seat = seat;
    d.showModal();
}

function edit_name_finished(ev) {
    if (ev.keyCode != 13)
        return;
    ev.preventDefault();
    edit_name_close(ev);
}

function edit_name_close(ev) {
    let d = document.getElementById("edit-name-dialog");
    d.close();
    let name = document.getElementById("edit-name-input").value;
    if (name)
        name = NameConnector + name;
    document.getElementById(d.seat + "-name").innerHTML = name;
    d.seat = null;
}

/*
 * Change score system functions
 */

function system_click(ev) {
    confirm_show("Switch to " + this.value + " scoring?<br/>" +
                 "All current and total scores will be erased.",
                 system_set.bind(this, this.value), system_reset.bind(this));
}

function system_set(system) {
    let above = document.getElementById("above-the-line");
    let below = document.getElementById("below-the-line");
    if (system == "Duplicate") {
        /* There is no "above the line" for duplicate scoring */
        above.style.display = "none";
        below.classList.remove("below-line-row");
        below.classList.add("below-line-row-duplicate");
    } else if (system == "Chicago" || system == "Rubber") {
        above.style.display = "revert";
        below.classList.remove("below-line-row-duplicate");
        below.classList.add("below-line-row");
    } else {
        alert_show("Unsupported scoring system: " + system, null);
        return;
    }
    clear_all();
    ScoreSystem = system;
}

function system_reset() {
    this.value = ScoreSystem;
}

/*
 * Speech recognition
 */

function speech_start(ev) {
    recognition.start();
    document.getElementById("speech-button")
        .classList.add("input-listening");
}

function speech_end(ev) {
    recognition.stop();
    document.getElementById("speech-button")
        .classList.remove("input-listening");
}

function speech_result(ev) {
    /*
    console.debug("speech recognition result");
    console.debug(ev.results[0][0].transcript);
    */
    document.getElementById("speech-button")
        .classList.remove("input-listening");
    try {
        let sr = speech_extract(speech_parser, ev.results[0][0].transcript);
        switch (sr[0]) {
            case "contract":
                contract_show(sr[1]);
                break;
            case "result":
                let result = document.getElementById("result-made");
                if (result.disabled)
                    alert_show("Contract has not been set yet", null);
                else
                    result_show(sr[1]);
                break;
        }
    } catch (err) {
        alert_show("speech recognition: " + err.message + "<br/>" +
                   "transcript: " + ev.results[0][0].transcript, null);
    }
}

function speech_nomatch(ev) {
    alert_show("speech recognition error: " +
               "grammatical error: " + ev.message, null);
}

function speech_error(ev) {
    alert_show("speech recognition error: " +
               "internal error: " + ev.error +
               ": " + ev.message, null);
}

/*
 * Utility functions
 */

function optionbox_reset(eid) {
    let e = document.getElementById(eid);
    e.classList.add("missing-value");
    e.dispatchEvent(new Event("reset"));
}

function select_reset(eid) {
    let e = document.getElementById(eid);
    e.value = "none";
    e.classList.add("missing-value");
}

function alert_show(msg, cb) {
    document.getElementById("alert-text").innerHTML = msg;
    let d = document.getElementById("alert-dialog");
    d.callback = cb;
    d.showModal();
}

function alert_hide(ev) {
    ev.preventDefault();
    let d = document.getElementById("alert-dialog");
    d.close();
    if (d.callback) {
        d.callback();
        d.callback = null;
    }
}

function confirm_show(msg, cb_yes, cb_no) {
    document.getElementById("confirm-text").innerHTML = msg;
    let d = document.getElementById("confirm-dialog");
    d.callback_yes = cb_yes;
    d.callback_no = cb_no;
    d.showModal();
}

function confirm_yes() {
    let d = document.getElementById("confirm-dialog");
    d.close();
    if (d.callback_yes)
        d.callback_yes();
    d.callback_yes = null;
    d.callback_no = null;
}

function confirm_no() {
    let d = document.getElementById("confirm-dialog");
    d.close();
    if (d.callback_no)
        d.callback_no();
    d.callback_yes = null;
    d.callback_no = null;
}

/*
 * Initialization function
 */

window.onload = function() {
    /* Convert string with HTML entity to raw string */
    let div = document.createElement("div");
    div.innerHTML = NameConnector;
    NameConnector = div.firstChild.nodeValue;

    /* Add event listeners */
    for (let ne of document.getElementsByClassName("seat-name"))
        ne.addEventListener("click", edit_name);
    for (let de of document.getElementsByClassName("dealer"))
        de.addEventListener("click", dealer_update);
    var contract_level = new OptionBox("contract-level",
                                       ["Level", "1", "2", "3", "4",
                                        "5", "6", "7"],
                                       ["none",  "1", "2", "3", "4",
                                        "5", "6", "7"],
                                       contract_update);
    var contract_suit = new OptionBox("contract-suit",
                                     ["Suit", "No trump", "Spades",
                                      "Hearts", "Diamonds", "Clubs"],
                                     ["none", "N", "S", "H", "D", "C"],
                                     contract_update);
    var contract_seat = new OptionBox("contract-seat",
                                     ["Seat", "North", "East", "South", "West"],
                                     ["none", "N", "E", "S", "W"],
                                     contract_update);
    var contract_doubled = new OptionBox("contract-doubled",
                                         ["Doubled?", "Undoubled",
                                          "Doubled", "Redoubled"],
                                         ["none", "", "x", "xx"],
                                         contract_update);
    var result_made = new OptionBox("result-made",
                                    ["Made?", "Made", "Down"],
                                    ["none", "+", "-"],
                                    result_update);
    document.getElementById("result-tricks")
        .addEventListener("change", result_update);
    document.getElementById("input-undo")
        .addEventListener("click", undo_click);
    document.getElementById("input-clear")
        .addEventListener("click", clear_click);
    document.getElementById("input-stats")
        .addEventListener("click", stats_click);
    document.getElementById("alert-close")
        .addEventListener("click", alert_hide);
    document.getElementById("confirm-yes")
        .addEventListener("click", confirm_yes);
    document.getElementById("confirm-no")
        .addEventListener("click", confirm_no);
    document.getElementById("eom-close")
        .addEventListener("click", eom_close);
    document.getElementById("stats-close")
        .addEventListener("click", stats_close);
    document.getElementById("edit-name-input")
        .addEventListener("keydown", edit_name_finished);
    document.getElementById("edit-name-close")
        .addEventListener("click", edit_name_close);
    document.getElementById("system")
        .addEventListener("change", system_click);
    document.getElementById("match")
        .addEventListener("change", match_update_selected);

    let sb = document.getElementById("speech-button");
    if (sb) {
        try {
            SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SR();
            SGL = window.SpeechGrammarList || window.webkitSpeechGrammarList;
            if (SGL != undefined) {
                /* SpeechGrammarList is experimental and not always available
                 * (on any iOS browser as of 4/24/2024).  Results are bad
                 * without the grammar, so maybe we should just punt here. */
                let sgl = new SGL();
                sgl.addFromString(BridgeScoreGrammar, 1);
                recognition.grammar = sgl;
            }
            recognition.continuous = false;
            recognition.lang = "en-US";
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.addEventListener("speechend", speech_end);
            recognition.addEventListener("result", speech_result);
            recognition.addEventListener("nomatch", speech_nomatch);
            recognition.addEventListener("error", speech_error);
            speech_parser = new JSGFParser(BridgeScoreGrammar);
            document.getElementById("speech-button")
                .addEventListener("click", speech_start);
            /* bridge_grammar_test(); */
        } catch(err) {
            alert("speech recognition not available: " + err.message);
            sb.style.display = "none";
        }
    }

    /* Finish setup */
    match_update();
    system_set(document.getElementById("system").value);
    dealer_show(null);
    contract_clear();
    contract_disable(false);
    result_clear();
    result_disable(true);
}
