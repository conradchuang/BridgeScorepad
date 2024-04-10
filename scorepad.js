/* vim: set ai et sw=4 sts=4: */

ScoreSystem = "Duplicate";   /* One of Duplicate, Chicago, Rubber */
SuitName = {
    N: "N",
    S: "&spades;",
    H: "&hearts;",
    D: "&diams;",
    C: "&clubs;",
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
SideName = {
    ew: "East-West",
    ns: "North-South",
}
OtherSide = {
    ew: "ns",
    ns: "ew",
}

TotalScore = { ns:0, ew:0 };
HandResults = [];
Vulnerability = { ns: false, ew: false }
BelowRows = [];
NextRow = { ns: 0, ew: 0 };

/* Contract is of form "level suit [double] [redouble] seat" */
REContract = /([1234567][NSHDC]X{0,2})([NESW])/;
REContractDetails = /([1234567])([NSHDC])(X{0,2})([NESW])/;
/* Result is of form "[+-]#" */
REResult = /([-+]?)(\d+)/;

function set_vulnerability(side, onoff) {
    let players = document.getElementsByClassName(side);
    for (let player of players) {
        if (onoff)
            player.classList.add("vulnerable");
        else
            player.classList.remove("vulnerable");
    }
    Vulnerability[side] = onoff;
}

function get_player_seat(id) {
    return id.split("-")[1];
}

function update_name(ev) {
    /* this = element triggering event */
    let name = this.value || "";
    let seat = get_player_seat(this.id);
    document.getElementById(seat + "-name").innerHTML = name;
}

function update_dealer() {
    /* this = element triggering event */
    let seat = this.value;
    /* Hide previous dealer and show seat as current dealer */
    let players = document.getElementsByClassName("dealing");
    for (let i = 0; i < players.length; i++)
        players[i].classList.remove("dealing");
    let te = document.getElementById(seat + "-dealer");
    te.classList.add("dealing");
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
        labels[seat] = "";
    }
    for (let seat in labels)
        document.getElementById(seat + "-contract").innerHTML = labels[seat];
    /* Set vulnerability.
     * For Chicago and duplicate scoring, vulnerability
     * depends on number of hands dealt */
    if (ScoreSystem == "Duplicate" || ScoreSystem == "Chicago") {
        switch (seat) {
            case "north":
            case "south":
                us = "ns";
                them = "ew";
                break;
            case "east":
            case "west":
                us = "ew";
                them = "ns";
                break;
        }
        switch (HandResults.length % 4) {
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

function update_contract(ev) {
    if (ev.keyCode != 13)
        return;
    ev.preventDefault();
    let contract_details = parse_contract_details(this.value);
    if (contract_details == null) {
        alert_show("That is not a valid contract.", focus_on_contract);
        return;
    }
    this.value = contract_details.whole;
    /* Hide dealer icon and show contract on board */
    let dealing = document.getElementsByClassName("dealing")
    for (let de of dealing)    /* should be exactly zero or one item */
        de.classList.remove("dealing");
    /* Display final contract on board */
    let seat = SeatAbbr[contract_details.declarer];
    for (let s in NextSeat) {
        let ce = document.getElementById(s + "-contract");
        ce.innerHTML = s == seat ? html_contract(contract_details, false) : "";
    }
    /* Disable contract input and move focus to result input field */
    let result = document.getElementById("input-result");
    result.value = "";
    result.disabled = false;
    result.focus();
}

function clear_section(id) {
    document.getElementById(id).innerHTML = "";
}

function clear_scorepad() {
    clear_section("ns-above");
    clear_section("ns-below");
    clear_section("ew-above");
    clear_section("ew-below");
    HandResults = [];
    show_match_totals();
    set_vulnerability("ns", false);
    set_vulnerability("ew", false);
    BelowRows = [];
    NextRow = { ns: 0, ew: 0 };
}

function parse_contract_details(s) {
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

function html_contract(contract_details, include_declarer) {
    let s = [contract_details.level,
             SuitName[contract_details.suit],
             contract_details.doubled];
    if (include_declarer)
        s.push(contract_details.declarer);
    return s.join("");
}

function contract_label(deal_index, contract_details, result_info) {
    return (deal_index+1) + ": " + html_contract(contract_details, true) +
           result_info.sign + result_info.value;
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

function part_scores() {
    let part_scores = {ns:0, ew:0};
    for (let result of HandResults) {
        part_scores[result.winning_side] += result.score_below;
        if (part_scores[result.winning_side] >= 100)
            part_scores = {ns:0, ew:0};
    }
    return part_scores;
}

function part_score(side) {
    return part_scores()[side];
}

function update_scorepad(contract_details, result) {
    let level = parseInt(contract_details.level);
    let suit = contract_details.suit;
    /* 0:undoubled 1:doubled 2:redoubled */
    let doubled = contract_details.doubled.length;
    let seat = contract_details.declarer;
    let side = seat.match(/[EW]/) ? "ew" : "ns";
    let tricks = parseInt(result.value);
    if (result.sign == "-")
        tricks = -tricks;
    else if (tricks < level || tricks > 7)
        throw new RangeError("too few tricks for contract");
    let vulnerable = Vulnerability[side]
    let deal_index = HandResults.length;
    let label = contract_label(deal_index, contract_details, result)
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
        label += " (not vul)";
        desc += ", not vulnerable,";
    }
    /* Add result to history */
    let hand_result = {deal_index: deal_index,
                       contract_details: contract_details,
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
        confirm_show(msg, contract_made.bind(null, hand_result, side, contract,
                                             score_above, score_total, label,
                                             breakdown_msg, draw_line,
                                             end_of_match), null);
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
        confirm_show(msg, contract_down.bind(null, hand_result, other_side,
                                             undertricks, label, breakdown_msg,
                                             end_of_match), null);
    }
}

function contract_made(hand_result, side, contract, score_above, score_total,
                       label, breakdown_msg, draw_line, end_of_match) {
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
    HandResults.push(hand_result);
    show_match_totals();
    if (end_of_match)
        end_match();
    else
        next_hand();
}

function contract_down(hand_result, other_side, undertricks, label,
                       breakdown_msg, end_of_match) {
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
    HandResults.push(hand_result);
    show_match_totals();
    if (end_of_match)
        end_match();
    else
        next_hand();
}

function show_match_totals() {
    let match_total = { ns:0, ew:0 };
    for (let result of HandResults)
        match_total[result.winning_side] += result.score_total;
    document.getElementById("score-ns-match").innerHTML = match_total.ns;
    document.getElementById("score-ew-match").innerHTML = match_total.ew;
}

function end_match(end_of_match) {
    let final = {ns:0, ew:0};
    let msg;
    for (let hand_result of HandResults)
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
        update_scorepad(parse_contract_details(ce.value), result_info);
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
    let dealings = document.getElementsByName("dealing");
    let cur_seat = null;
    for (let de of dealings) {
        if (de.checked) {
            cur_seat = de.value;
            de.checked = false;
        }
    }
    let next_seat = NextSeat[cur_seat];
    for (let de of dealings) {
        if (de.value == next_seat) {
            de.checked = true;
            update_dealer.call(de);
            break;
        }
    }
    /* Clear contract and result fields */
    let contract = document.getElementById("input-contract");
    contract.value = "";
    contract.disabled = false;
    /* Only change the focus if there is no dialog (such
     * as end-of-match) is open */
    if (!document.getElementById("eom-dialog").open)
        contract.focus();
    let result = document.getElementById("input-result")
    result.value = "";
    result.disabled = true;
}

function input_undo() {
    if (HandResults.length == 0)
        alert_show("There are no results to undo", null);
    else
        confirm_show("Remove last contract score?", undo, null);
}

function undo() {
    /* Remove last result */
    let last_result = HandResults.pop();
    if (last_result.state_score_above != null)
        undo_above_score(last_result.state_score_above);
    if (last_result.state_score_below != null)
        undo_below_score(last_result.state_score_below);
    /* Recompute vulnerability if necessary */
    if (ScoreSystem == "Rubber") {
        set_vulnerability("ns", false);
        set_vulnerability("ew", false);
        let below_scores = {ns:0, ew:0};
        for (let result of HandResults) {
            below_scores[result.winning_side] += result.score_below;
            if (below_scores[result.winning_side] >= 100) {
                below_scores = {ns:0, ew:0};
                set_vulnerability(result.winning_side, true);
            }
        }
    }
    /* Show dealer for last hand */
    let dealings = document.getElementsByName("dealing");
    let cur_seat = null;
    for (let de of dealings)
        if (de.checked)
            cur_seat = de.value;
    let prev_seat = PrevSeat[cur_seat];
    for (let de of dealings) {
        if (de.value == prev_seat) {
            de.checked = true;
            update_dealer.call(de);
            break;
        }
    }
}

function input_clear() {
    onfirm_show("Clear all scores, including totals?", clear_all, null);
}

function clear_all() {
    clear_scorepad();
    TotalScore.ns = 0;
    TotalScore.ew = 0;
    show_accumulated_totals();
    /* Show dealer after history is wiped (affects vulnerability) */
    let dealings = document.getElementsByName("dealing");
    for (let de of dealings) {
        if (de.checked) {
            update_dealer.call(de);
            break;
        }
    }
}

function change_system() {
    confirm_show("Switch to " + this.value + " scoring?<br/>" +
                 "Current scores will be erased.)",
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

function show_accumulated_totals() {
    document.getElementById("score-ns-total").innerHTML = TotalScore.ns;
    document.getElementById("score-ew-total").innerHTML = TotalScore.ew;
}

function focus_on_contract() {
    document.getElementById("input-contract").focus();
}

function focus_on_result() {
    document.getElementById("input-result").focus();
}

function alert_show(msg, cb) {
    console.log("alert_show");
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

function eom_show(msg) {
    show_accumulated_totals();
    document.getElementById("eom-text").innerHTML = msg;
    document.getElementById("eom-dialog").show();
}

function eom_close(ev) {
    ev.preventDefault();
    document.getElementById("eom-dialog").close();
    document.getElementById("input-contract").focus();
    clear_scorepad();
    next_hand();
}

window.onload = function() {
    let names = document.getElementsByClassName("input-name");
    for (let ne of names) {
        ne.addEventListener("change", update_name);
        update_name.call(ne);
    }
    let dealings = document.getElementsByName("dealing");
    for (let de of dealings) {
        de.addEventListener("click", update_dealer);
        if (de.checked)
            update_dealer.call(de);
    }
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
    let se = document.getElementById("system");
    se.addEventListener("change", change_system);
    set_system(se.value);
}
