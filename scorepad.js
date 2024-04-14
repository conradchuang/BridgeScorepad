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

/*
 * Vulnerability functions
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

/*
 * Dealer functions
 */

function update_dealer(ev) {
    /* this = element triggering event */
    show_dealer(this.getAttribute("seat"));
}

function show_dealer(seat) {
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

function clear_section(id) {
    document.getElementById(id).innerHTML = "";
}

function clear_scorepad() {
    clear_section("ns-above");
    clear_section("ns-below");
    clear_section("ew-above");
    clear_section("ew-below");
    MatchResults = [];
    show_match_totals();
    set_vulnerability("ns", false);
    set_vulnerability("ew", false);
    BelowRows = [];
    NextRow = { ns: 0, ew: 0 };
}

function make_side_row(side) {
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

function add_below_score(side, contract, value, made_game, title) {
    let state = { next_row:{ ...NextRow }, side:side };
    let want_row = NextRow[side];
    let row_pair;
    if (want_row >= BelowRows.length) {
        row_pair = { ns: make_side_row("ns"), ew: make_side_row("ew") };
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

function undo_below_score(state) {
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

function add_above_score(side, contract, value, title) {
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

function undo_above_score(state) {
    state.row.remove();
}

function update_scorepad(contract_info, result, redisplay) {
    let level = parseInt(contract_info.level);
    let suit = contract_info.suit;
    /* 0:undoubled 1:doubled 2:redoubled */
    let doubled = contract_info.doubled.length;
    let seat = contract_info.declarer;
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
            overtricks = num_over * (vulnerable ? 200 : 100);
            insult = 50;
        } else if (doubled == 2) {  /* redoubled */
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
            contract_made(hand_result, side, contract, score_above,
                          score_total, label, breakdown_msg, draw_line,
                          end_of_match, true);
        else
            confirm_show(msg,
                         contract_made.bind(null, hand_result, side, contract,
                                            score_above, score_total, label,
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
                    undertricks = tricks + 1 * 300 - 200;
                } else {
                    undertricks = -200;
                }
            } else if (doubles == 2) {
                /* 600 for each trick -4 +
                 * 600 for tricks -2 and -3 +
                 * 400 for tricks -1 */
                if (tricks <= -2) {
                    undertricks = tricks + 1 * 600 - 400;
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
                    undertricks = tricks + 3 * 300 - 2*200 - 100;
                } else if (tricks <= -2) {
                    undertricks = tricks + 1 * 200 - 100;
                } else {
                    undertricks = -100;
                }
            } else if (doubles == 2) {
                /* 600 for each trick -4 +
                 * 400 for tricks -2 and -3 +
                 * 200 for tricks -1 */
                if (tricks <= -4) {
                    undertricks = tricks + 3 * 600 - 2*400 - 200;
                } else if (tricks <= -2) {
                    undertricks = tricks + 1 * 400 - 200;
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
            contract_down(hand_result, other_side, undertricks, label,
                          breakdown_msg, end_of_match, true);
        else
            confirm_show(msg,
                         contract_down.bind(null, hand_result, other_side,
                                            undertricks, label, breakdown_msg,
                                            end_of_match, false), null);
    }
}

function contract_made(hand_result, side, contract, score_above, score_total,
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
        hand_result.state_score_below = add_below_score(side, label,
                                                        score_total, false,
                                                        breakdown_msg);
    } else {
        hand_result.state_score_below = add_below_score(side, label,
                                                        contract, draw_line,
                                                        breakdown_msg);
        if (score_above > 0) {
            hand_result.state_score_above = add_above_score(side, label,
                                                            score_above,
                                                            breakdown_msg);
        }
    }
    MatchResults.push(hand_result);
    show_match_totals();
    if (!redisplay) {
        if (end_of_match)
            end_match();
        else
            next_hand();
    }
}

function contract_down(hand_result, other_side, undertricks, label,
                       breakdown_msg, end_of_match, redisplay) {
    /* Display on score pad */
    hand_result.winning_side = other_side;
    hand_result.score_total = undertricks;
    hand_result.score_above = undertricks;
    hand_result.score_below = 0;
    hand_result.state_score_below = null;
    if (ScoreSystem == "Duplicate") {
        hand_result.state_score_below = add_below_score(other_side, label,
                                                        undertricks, false,
                                                        breakdown_msg);
    } else {
        hand_result.state_score_above = add_above_score(other_side, label,
                                                        undertricks,
                                                        breakdown_msg);
    }
    MatchResults.push(hand_result);
    show_match_totals();
    if (!redisplay) {
        if (end_of_match)
            end_match();
        else
            next_hand();
    }
}

function show_match_totals() {
    let match_total = { ns:0, ew:0 };
    for (let result of MatchResults)
        match_total[result.winning_side] += result.score_total;
    document.getElementById("score-ns-match").innerHTML = match_total.ns;
    document.getElementById("score-ew-match").innerHTML = match_total.ew;
}

function show_accumulated_totals() {
    document.getElementById("score-ns-total").innerHTML = TotalScore.ns;
    document.getElementById("score-ew-total").innerHTML = TotalScore.ew;
}

/*
 * End of match functions
 */

function end_match() {
    let final = {ns:0, ew:0};
    let msg;
    for (let hand_result of MatchResults)
        final[hand_result.winning_side] += hand_result.score_total;
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
    show_accumulated_totals();
    document.getElementById("eom-text").innerHTML = msg;
    document.getElementById("eom-dialog").show();
}

function eom_close(ev) {
    ev.preventDefault();
    document.getElementById("eom-dialog").close();
    document.getElementById("input-contract").focus();
    Matches.push(MatchResults);
    clear_scorepad();
    next_hand();
    update_matches();
}

function update_matches() {
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

function update_selected_match(ev) {
    let selected_match = parseInt(this.value);
    if (selected_match == CurrentMatch)
        return;
    if (CurrentMatch == -1)
        CurrentMatchResults = MatchResults;
    CurrentMatch = selected_match;
    if (selected_match == -1) {
        /* Current match */
        redisplay_match(CurrentMatchResults);
        disable_contract(false);
    } else {
        /* Previous match */
        disable_contract(true);
        redisplay_match(Matches[selected_match]);
    }
}

function redisplay_match(results) {
    clear_scorepad();
    for (let result of results)
        update_scorepad(result.contract_info, result.result, true);
}

/*
 * Contract functions
 */

function update_contract(ev) {
    if (ev.keyCode != 13)
        return;
    ev.preventDefault();
    let contract_info = parse_contract(this.value);
    if (contract_info == null) {
        alert_show("That is not a valid contract.", focus_on_contract);
        return;
    }
    this.value = contract_info.whole;
    /* Display final contract on board */
    let seat = SeatAbbr[contract_info.declarer];
    for (let s in NextSeat) {
        let ce = document.getElementById(s + "-contract");
        ce.innerHTML = s == seat ? html_contract(contract_info, false) : "";
    }
    /* Disable contract input and move focus to result input field */
    let result = document.getElementById("input-result");
    result.value = "";
    result.disabled = false;
    result.focus();
}

function parse_contract(s) {
    let ns = s.replace(/\s/g, '').toUpperCase();
    let parts = ns.match(REContractDetails);
    if (parts == null)
        return null;
    return { whole: parts[0],
             level: parts[1],
             suit: parts[2],
             doubled: parts[3],
             declarer: parts[4] }
}

function html_contract(contract, include_declarer) {
    let s = [contract.level,
             SuitName[contract.suit],
             contract.doubled];
    if (include_declarer)
        s.push(contract.declarer);
    return s.join("");
}

function contract_label(deal_index, contract_info, result_info) {
    return (deal_index+1) + ": " + html_contract(contract_info, true) +
           result_info.sign + result_info.value;
}

function focus_on_contract() {
    document.getElementById("input-contract").focus();
}

function disable_contract(onoff) {
    document.getElementById("input-contract").disabled = onoff;
}

/*
 * Result functions
 */
function parse_result(s) {
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

function html_result(result_info) {
    return result_info.sign + result_info.value;
}

function update_result(ev) {
    if (ev.keyCode != 13)
        return;
    ev.preventDefault();
    let result_info = parse_result(this.value);
    if (result_info == null) {
        alert_show("That is not a valid result.", null);
        return;
    }
    /* Update score pad */
    let ce = document.getElementById("input-contract");
    try {
        update_scorepad(parse_contract(ce.value), result_info, false);
    } catch (e) {
        if (e instanceof RangeError) {
            alert_show(e.message, focus_on_result);
            return;
        } else {
            throw e;
        }
    }
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
    show_dealer(next_seat);
    /* Clear contract and result fields */
    let contract = document.getElementById("input-contract");
    contract.value = "";
    contract.disabled = false;
    contract.focus();
    let result = document.getElementById("input-result")
    result.value = "";
    result.disabled = true;
}

function focus_on_result() {
    document.getElementById("input-result").focus();
}

/*
 * Undo functions
 */

function input_undo(ev) {
    if (MatchResults.length == 0)
        alert_show("There are no results to undo", null);
    else
        confirm_show("Remove last contract score?", undo, null);
}

function undo() {
    /* Remove last result */
    let last_result = MatchResults.pop();
    if (last_result.state_score_above != null)
        undo_above_score(last_result.state_score_above);
    if (last_result.state_score_below != null)
        undo_below_score(last_result.state_score_below);
    /* Recompute vulnerability if necessary */
    if (ScoreSystem == "Rubber") {
        set_vulnerability("ns", false);
        set_vulnerability("ew", false);
        let below_scores = {ns:0, ew:0};
        for (let result of MatchResults) {
            below_scores[result.winning_side] += result.score_below;
            if (below_scores[result.winning_side] >= 100) {
                below_scores = {ns:0, ew:0};
                set_vulnerability(result.winning_side, true);
            }
        }
    }
    show_match_totals();
    /* Show dealer for last hand */
    let dealers = document.getElementsByClassName("dealing");
    if (dealers.length != 1) {
        alert("Something is horribly wrong (undo)");
        return;
    }
    let de = dealers[0];
    let cur_seat = de.getAttribute("seat");
    let prev_seat = PrevSeat[cur_seat];
    show_dealer(prev_seat);
}

/*
 * Clear scores functions
 */

function input_clear(ev) {
    confirm_show("Clear all scores, including totals?", clear_all, null);
}

function clear_all() {
    clear_scorepad();
    TotalScore.ns = 0;
    TotalScore.ew = 0;
    show_accumulated_totals();
    show_dealer(null);
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
 * Part score functions
 */
function part_scores() {
    let part_scores = {ns:0, ew:0};
    for (let result of MatchResults) {
        part_scores[result.winning_side] += result.score_below;
        if (part_scores[result.winning_side] >= 100)
            part_scores = {ns:0, ew:0};
    }
    return part_scores;
}

function part_score(side) {
    return part_scores()[side];
}

/*
 * Change score system functions
 */

function change_system(ev) {
    confirm_show("Switch to " + this.value + " scoring?<br/>" +
                 "All current and total scores will be erased.",
                 set_system.bind(this, this.value), null);
}

function set_system(system) {
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

/*
 * Utility functions
 */

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
        de.addEventListener("click", update_dealer);
    document.getElementById("input-contract")
        .addEventListener("keydown", update_contract);
    document.getElementById("input-result")
        .addEventListener("keydown", update_result);
    document.getElementById("input-undo")
        .addEventListener("click", input_undo);
    document.getElementById("input-clear")
        .addEventListener("click", input_clear);
    document.getElementById("alert-close")
        .addEventListener("click", alert_hide);
    document.getElementById("confirm-yes")
        .addEventListener("click", confirm_yes);
    document.getElementById("confirm-no")
        .addEventListener("click", confirm_no);
    document.getElementById("eom-close")
        .addEventListener("click", eom_close);
    document.getElementById("edit-name-input")
        .addEventListener("keydown", edit_name_finished);
    document.getElementById("edit-name-close")
        .addEventListener("click", edit_name_close);
    document.getElementById("system")
        .addEventListener("change", change_system);
    document.getElementById("match")
        .addEventListener("change", update_selected_match);

    /* Finish setup */
    update_matches();
    set_system(document.getElementById("system").value);
    show_dealer(null);
}
