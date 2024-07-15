/* vim: set ai et sw=4 sts=4: */

/*
 * OptionBox is an UI element for selecting different options
 * simply by clicking on the element.  Clicking on the right-hand 
 * side selects the next option; clicking on the left-hand side
 * selects the previous option.  This is useful for touch devices
 * where a dropdown selector (like <select>) can get tiresome if
 * there are several fields to set.
 */

class OptionBox {

    /*
     * eid should be the element id for a <button>.
     * options is a list of display text strings.
     * values is a parallel list of option values.
     * The first option is displayed automatically.
     */
    constructor(eid, options, values, callback) {
        this.eid = eid;
        this.options = options;
        this.values = values;
        this.callback = callback;
        this.selected = 0;
        this.element = document.getElementById(eid);
        this.set(this.selected);
        this.element.addEventListener("click", this.cb_click.bind(this));
        this.element.addEventListener("reset", this.cb_reset.bind(this));
    }

    val() {
        return this.values[this.selected];
    }

    set(index) {
        this.selected = index;
        this.element.value = this.values[index];
        this.element.textContent = this.options[index];
    }

    cb_click(ev) {
        console.log("click");
        let bbox = ev.target.getBoundingClientRect();
        let e_x = ev.clientX - bbox.left;
        if (e_x < bbox.width / 2)
            this.prev();
        else
            this.next();
        this.callback();
    }

    cb_reset(ev) {
        console.log("reset");
        this.set(0);
    }

    next() {
        let index = this.selected + 1;
        if (index >= this.options.length)
            index = 0;
        this.set(index);
    }

    prev(ev) {
        let index = this.selected - 1;
        if (index < 0)
            index = this.options.length - 1;
        this.set(index);
    }

}
