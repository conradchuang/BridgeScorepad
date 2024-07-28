/* vim: set ai et sw=4 sts=4: */

/*
 * SegmentedControl is an UI element for selecting different options
 * simply by clicking on the element.
 */

class SegmentedControl {

    /*
     * eid should be the element id for a <div> whose
     * width is predetermined.
     * options is a list of display text strings.
     * values is a parallel list of option values.
     */
    constructor(peid, eid, options, values, callback) {
        this.eid = eid;
        // We skip index 0 for compatibility with optionbox,
        // which uses options[0] as a label.
        this.default_value = values[0];
        this.options = options.slice(1);
        this.values = values.slice(1);
        this.callback = callback;
        let parent = document.getElementById(peid);
        this.selected = -1;
        this.element = this.make_element("table", parent, eid);
        let tr = this.make_element("tr", this.element);
        for (let i = 0; i < this.options.length; i++) {
            let td = this.make_element("td", tr);
            td.innerHTML = this.options[i];
            td.setAttribute("data-index", i);
            td.setAttribute("data-value", this.values[i]);
            td.addEventListener("click", this.cb_click.bind(this));
        }
        this.set(this.selected);
        this.element.addEventListener("reset", this.cb_reset.bind(this));
    }

    make_element(etype, parent, eid) {
        let e = document.createElement(etype);
        if (eid)
            e.id = eid;
        e.classList.add("segmented-control-" + etype);
        if (parent != null)
            parent.appendChild(e);
        return e;
    }

    val() {
        return this.values[this.selected];
    }

    set(index) {
        let opts = this.element.getElementsByTagName("td");
        for (let i = 0; i < opts.length; i++)
            opts[i].classList.remove("segmented-control-selected");
        this.selected = index;
        let value = this.default_value;
        if (index >= 0) {
            opts[index].classList.add("segmented-control-selected");
            value = this.val();
        }
        this.element.value = value;
    }

    cb_click(ev) {
        let index = ev.target.getAttribute("data-index");
        if (this.selected == index)
            return;
        this.set(index);
        this.callback();
    }

    cb_reset(ev) {
        this.set(-1);
    }

}
