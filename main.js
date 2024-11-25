"use strict";

let g_db = null

function save_db() {
    const json = g_db.to_json()
    const json_s = JSON.stringify(json)
    localStorage.setItem("db", json_s)
}
function load_db() {
    const json_s = localStorage.getItem("db")
    if (json_s === null)
        return
    const json = JSON.parse(json_s)
    if (json === null)
        return
    g_db = Database.from_json(null, json)
}


function arr_to_json(objs) {
    const arr = []
    for(const a of objs)
        arr.push(a.to_json())
    return arr
}
function arr_from_json(ctx, jarr, cls) {
    const arr = []
    if (jarr !== undefined)
        for(const p of jarr) {
            const inst = cls.from_json(ctx, p)
            if (inst !== null) // assume error was already logged
                arr.push(inst)
        }
    return arr
}
function checkParseAmount(s) {
    if (s.length == 0)
        return 0
    const v = parseFloat(s.replace(/[^0-9.-]/g, ''))
    if (isNaN(v))
        throw new Error("value not a number " + s)
    return v
}
function checkParseInt(s) {
    const v = parseFloat(s)
    if (isNaN(v))
        throw new Error("value not a number " + s)
    return v
}
function dequote(s) {
    return s.replace(/^"(.+)"$/,'$1').replace(/""/g, '"')
}
function roundAmount(n) {
    return (Math.round(n * 100)/100).toFixed(2)
}
function roundAmountNum(n) {
    return (Math.round(n * 100)/100)
}
function hide(e, v) {
    if (v)
        e.classList.add("hidden")
    else
        e.classList.remove("hidden")
}
function removeElem(e) {
    e.parentElement.removeChild(e)
}

class Obj
{
    constructor(ctx) {
        this.ctx = ctx
        this.elem = null
    }

    invalidate() {
        if (this.elem === null)
            return
        removeElem(this.elem) 
        this.elem = null
    }
}

class Database extends Obj
{
    constructor(ctx) {
        super(ctx)
        this.periods = []
        this.selected_period_idx = 0
        this.tags = new TagsEditor(this)

        this.elem = null
        this.accounts_cont_elem = null
        this.tags_edit_elem = null
    }
    static from_json(ctx, j) {
        const db = new Database(ctx)
        g_db = db
        db.tags = TagsEditor.from_json(db, j.tags) // needs to be first
        db.periods = arr_from_json(db, j.periods, Period)
        if (j.selected_period_idx)
            db.selected_period_idx = j.selected_period_idx
        return db
    }
    to_json() {
        return { periods: arr_to_json(this.periods), 
                 selected_period_idx: this.selected_period_idx, 
                 tags: this.tags.to_json() }
    }

    selected_period() {
        return this.periods[this.selected_period_idx]
    }
    set_selected(p) {
        if (this.selected_period())
            this.selected_period().side_btn_elems.selector.classList.remove("selected_period")
        const idx = this.periods.indexOf(p)
        this.selected_period_idx = idx
        if (this.selected_period()) {
            this.selected_period().side_btn_elems.selector.classList.add("selected_period")
            this.show_selected_period()
        }
    }

    remove_period(period) {
        const idx = this.periods.indexOf(period)
        this.periods.splice(idx, 1)
        removeElem(period.side_btn_elems.selector)
        this.accounts_cont_elem.innerText = ""
        this.selected_period_idx = -1
        save_db()
    }

    show_selected_period()
    {
        this.accounts_cont_elem.innerText = ""
        const period = this.selected_period()
        period.show(this.accounts_cont_elem)
    }

    // called once on startup
    show(parent) 
    {
        this.elem = add_div(parent, "period_cont")
        add_div(parent, "periods_standin")
        this.accounts_cont_elem =  add_div(parent, "accounts_cont")
        const dlg = this.show_tags_dlg()
        
        const p_btns = add_div(this.elem, "period_btns")
        for(const p of this.periods) {
            this.show_period_btn(p_btns, p)
        }
        this.set_selected(this.selected_period())
        add_push_btn(this.elem, "הוסף תקופה", ()=>{
            const p = new Period(this, "אין שם")
            this.periods.push(p)
            this.show_period_btn(p_btns, p)
            this.set_selected(p)
            save_db()
        }, "sidebar_btn")
        add_push_btn(this.elem, "טגיות", ()=>{
            dlg.set_visible(!dlg.visible)
        }, "sidebar_btn")
    }

    show_tags_dlg() {
        const rect = {visible:false}
        const dlg = create_dialog(body, "Tags", false, rect, null)
        dlg.elem.style.backgroundColor = "#ffffff"
        this.tags.show(dlg.client)
        return dlg
    }

    show_period_btn(parent, period) {
        const ps = add_div(parent, 'period_selector')
        const label = add_div(ps, "sel_btn_prname")
        label.innerText = period.name.value
        ps.addEventListener("click", ()=>{
            this.set_selected(period)
            save_db()
        })
        period.side_btn_elems = { selector: ps, label:label }
    }
}

class Period extends Obj
{
    constructor(ctx, name) {
        super(ctx)
        // shown in Database.show()
        this.name = new EntryTextValue(this, "prname", name)
        this.name.change_cb = (v)=>{ this.side_btn_elems.label.innerText = v }
        this.accounts = []
        this.elem = null
        this.accounts_elem = null
        this.side_btn_elems = null
        this.summary_elems = null
    }
    static from_json(ctx, j) {
        const p  = new Period(ctx, j.name)
        p.accounts = arr_from_json(p, j.accounts, Account)
        return p
    }
    to_json() {
        return { name: this.name.value, accounts: arr_to_json(this.accounts) }
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, "obj_period")
        const title_elem = add_div(this.elem, "period_title")
        this.name.show(title_elem)
        const remove_btn = add_div(title_elem, "entry_remove")
        remove_btn.addEventListener("click", ()=>{
            message_box(body,"", 'למחוק את תקופה' + ': "' + this.name.value + '"', [
                {text:"לא"}, {text:"כן", func:()=>{ this.ctx.remove_period(this) }}])
        })
        this.accounts_elem = add_div(this.elem, "period_accounts")
        this.show_summary(this.accounts_elem)
        for(const a of this.accounts) {
            a.show(this.accounts_elem)
        }
        add_push_btn(this.elem, "הוסף חשבון", ()=>{
            const a = new Account(this, "אין שם")
            this.accounts.push(a)
            save_db()
            a.show(this.accounts_elem)
        })
    }
    remove_account(account) {
        const idx = this.accounts.indexOf(account)
        this.accounts.splice(idx, 1)
        this.accounts_elem.removeChild(account.elem)
        save_db()
    }

    show_summary(parent) {
        const summary_cont = add_div(parent, "obj_account")
        const title_elem = add_div(summary_cont, "account_title")
        title_elem.innerText = "סיכום"
        const columns_cont = add_div(summary_cont, "summary_cont")
        const col_right = add_div(columns_cont, "sum_col")
        const col_left = add_div(columns_cont, "tb_col")

        const add_line = (label, cls_suffix="")=>{
            const line = add_div(col_right, "sum_line")
            add_div(line, ["sum_label", "sum_lbl_" + cls_suffix]).innerText = label
            const num = add_div(line, ["number_label", "sum_value", "sum_val_" + cls_suffix])
            num.innerText = 0
            num.value = 0
            return { num:num, add: (v)=>{ 
                num.value += v
                num.innerText = roundAmount(num.value)
            }, reset: ()=>{
                num.value = 0
                num.innerText = roundAmount(num.value)
            }}
        }
        const d = {}
        d.initial_balance = add_line("ייתרה התחלתית:")
        d.total = add_line("תזרים:")
        d.total_plus = add_line("הכנסות:", "tplus")
        d.total_minus = add_line("הוצאות:", "tminus")
        d.end_balance = add_line("ייתרה סופית:")
        d.col_left = col_left
        this.summary_elems = d

        this.update_summary()
    }
    update_summary() {
        const d = this.summary_elems
        if (d === null)
            return
        for(const n in d)
            if (d[n].num !== undefined)
                d[n].reset()
        const tb = new TagsBalances()
        for(const ac of this.accounts) {
            d.initial_balance.add(ac.initial_balance.amount.value)
            d.end_balance.add(ac.table.last_balances.balance)
            d.total_plus.add(ac.table.last_balances.plus)
            d.total_minus.add(ac.table.last_balances.minus)
            d.total.add(ac.table.last_balances.plus + ac.table.last_balances.minus)
            ac.table.tags_balance(tb)
        }
        // per-tag table
        const tb_lst = Object.values(tb.id_to_balance)
        tb_lst.sort((a, b)=>{ return b.magnitude() - a.magnitude() })
        d.col_left.innerText = ""
        for(const b of tb_lst) {
            const line = add_div(d.col_left, "tb_line")
            add_div(d.col_left, "tb_sep")
            const tag_wrap = add_div(line, "tb_tag_wrap")
            const tag_elem = add_div(tag_wrap)
            Tag.emplace(b.tag, tag_elem, true)
            const value1 = add_div(line, ["number_label", "tb_value"])
            if (b.plus == 0 || b.minus == 0) {
                value1.innerText = roundAmount(b.plus + b.minus)
            }
            else {
                const value2 = add_div(line, ["number_label", "tb_value"])
                value1.innerText = roundAmount(b.plus)
                value2.innerText = roundAmount(b.minus)
            }
        }
    }
}

class TagsBalances {
    constructor() {
        this.id_to_balance = {}
    }
    add_for_tag(tag, v) {
        const id = Tag.get_id(tag)
        let b = this.id_to_balance[id]
        if (b === undefined)
            b = this.id_to_balance[id] = new TagBalances(tag)
        if (v < 0)
            b.minus += v
        else
            b.plus += v
        b.balance += v
    }
}

class Balances {
    constructor(balance, plus, minus) {
        this.balance = balance
        this.plus = plus
        this.minus = minus
    }
    clone() {
        return new Balances(this.balance, this.plus, this.minus)
    }
    magnitude() {
        return Math.abs(this.plus) + Math.abs(this.minus)
    }
}
class TagBalances extends Balances {
    constructor(tag) {
        super(0, 0, 0)
        this.tag = tag
    }
}

class Account extends Obj
{
    constructor(ctx, name) {
        super(ctx)
        this.name = new EntryTextValue(this, "acname", name)
        this.table = new Table(this)
        this.initial_balance = new BalanceEntry(this, 0)
        this.elem = null
    }
    static from_json(ctx, j) {
        const a = new Account(ctx, j.name)
        a.table = Table.from_json(a, j.table)
        a.initial_balance = BalanceEntry.from_json(a, j.initial_balance)
        a.trigger_balance()
        return a
    }
    to_json() {
        return { name:this.name.value, 
                 table:this.table.to_json(), 
                 initial_balance:this.initial_balance.to_json() }
    }
    show(parent) 
    {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, "obj_account")
        const title_elem = add_div(this.elem, "account_title")
        this.name.show(title_elem)
        const remove_btn = add_div(title_elem, "entry_remove")
        remove_btn.addEventListener("click", ()=>{
            message_box(body,"", 'למחוק את חשבון' + ': "' + this.name.value + '"', [
                {text:"לא"}, {text:"כן", func:()=>{ this.ctx.remove_account(this) }}])
        })
        // needed so that table can recreate itself by deleting it's elem
        const table_wrap = add_div(this.elem)
        this.table.show(table_wrap)
    }
    trigger_balance() {
        this.table.update_balance(new Balances(this.initial_balance.amount.value, 0, 0))
        this.ctx.update_summary()
    }
} 

class Table extends Obj
{
    constructor(ctx) {
        super(ctx)
        this.entries = []
        this.is_top_level = (this.ctx.constructor == Account)
        this.last_balances = new Balances(0, 0, 0)
        this.elem = null
        this.footer_elems = null
        this.entries_cont_elem = null
    }
    static from_json(ctx, j) {
        const t = new Table(ctx)
        if (j)
            t.entries = arr_from_json(t, j.entries, Entry)
        return t
    }
    to_json() {
        return { entries: arr_to_json(this.entries) }
    }
    size() {
        return this.entries.length
    }
    clear() {
        this.entries = []
        this.invalidate()
        save_db()
        this.entry_count_changed()
        this.trigger_balance()
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            hide(this.elem, false)
            return
        }
        this.elem = add_div(parent, "obj_table")
        if (!this.is_top_level)
            this.elem.classList.add("sub_table")
        else {
            const header = add_div(this.elem, "table_header")
            for(const f of Entry.FIELDS)
                add_div(header, ["table_hdr_field", "obj_val_hdr_" + f.name]).innerText = f.disp
        } 
        if (this.is_top_level) 
            this.ctx.initial_balance.show(this.elem)

        this.entries_cont_elem = add_div(this.elem, "table_entries")
        for(const e of this.entries)
            e.show(this.entries_cont_elem)

        this.show_footer(this.elem, parent)
    }
    hide() {
        if (this.elem === null)
            return
        hide(this.elem, true)
    }

    show_footer(parent, table_parent) {
        if (this.is_top_level) {
            const footer = add_div(parent, "table_footer")
            const sp1a = add_div(footer, ["table_footer_spacer_1a", "hidden"])
            const sp1b = add_div(footer, "table_footer_spacer_1b")
            const total_plus = add_div(footer, ["obj_val_value", "table_total", "table_tplus", "number_label", "hidden"])
            const total_minus = add_div(footer, ["obj_val_value", "table_total", "table_tminus", "number_label", "hidden"])
            const total = add_div(footer, ["obj_val_value", "table_total", "number_label"])
            add_div(footer, "table_footer_spacer_2")
            const balance = add_div(footer, ["obj_val_value", "table_footer_balance", "number_label"])
            this.footer_elems = { total_plus:total_plus, total_minus:total_minus, total:total, balance:balance }
            const hide_plus_minus = (v)=>{
                hide(total_plus, v)
                hide(total_minus, v)
                hide(sp1a, v)
                hide(total, !v)
                hide(sp1b, !v)
            }
            total_plus.addEventListener("click", ()=>{ hide_plus_minus(true) })
            total_minus.addEventListener("click", ()=>{ hide_plus_minus(true) })
            total.addEventListener("click", ()=>{ hide_plus_minus(false) })
        }

        const btns_line = add_div(parent, "table_btns")
        add_push_btn(btns_line, "הוסף שורה", ()=>{
            this.add_empty_entry()
            this.trigger_balance()
        }, "table_btn")
        add_push_btn(btns_line, 'הוסף דו"ח', ()=>{
            dlg_statement(body, this)
        }, "table_btn")
        add_push_btn(btns_line, "מחק", ()=>{
            message_box(body,"", 'למחוק את כל תוכן הטבלא?', [
                {text:"לא"}, {text:"כן", func:()=>{ 
                    this.clear()
                    this.show(table_parent) 
                }}])
        }, "table_btn")

        if (!this.is_top_level) { // add the balance in the btn line
            const sp = add_div(btns_line, "table_btns_spacer")
            const wrong_cont = add_div(btns_line, "wrong_cont")
            add_div(wrong_cont, "wrong_label").innerText = ":ייתרה שגויה"
            const expected_balance = add_div(wrong_cont, ["obj_val_value", "expected_balance", "number_label"])
            const balance = add_div(btns_line, ["obj_val_value", "table_footer_balance", "number_label"])
            this.footer_elems = { balance:balance, wrong_cont:wrong_cont, expected_balance:expected_balance }
        }
        this.update_footer()
    }


    add_empty_entry() {
        this.add_entry(new Entry(null, null, 0, "ריק", "")) 
    }
    add_entry(entry, need_save=true) { // to the end
        entry.ctx = this
        this.entries.push(entry)
        if (this.elem !== null)
            entry.show(this.entries_cont_elem)
        if (need_save)
            save_db()
        this.entry_count_changed()
    }
    remove_entry(entry) {
        const idx = this.entries.indexOf(entry)
        this.entries.splice(idx, 1)
        removeElem(entry.elem)
        save_db()
        this.entry_count_changed()
    }
    entry_count_changed() {
        if (this.ctx.constructor === Entry)
            this.ctx.update_has_breakdown()
    }
    update_footer() {
        if (!this.footer_elems)
            return
        this.footer_elems.balance.innerText = roundAmount(this.last_balances.balance)
        if (this.is_top_level) {
            this.footer_elems.total_plus.innerText = roundAmount(this.last_balances.plus)
            this.footer_elems.total_minus.innerText = roundAmount(this.last_balances.minus)
            this.footer_elems.total.innerText = roundAmount(this.last_balances.plus + this.last_balances.minus)
        }
        else {
            this.footer_elems.expected_balance.innerText = this.ctx.amount.value
            // sub-report can be negative but top-level entry can be positive
            const different = (this.get_inconsistency() != 0)
            hide(this.footer_elems.wrong_cont, !(different && this.size() > 0))
        }
    }
    get_relative_sign() {
        if (this.is_top_level)
            return 1
         // total amounts is inverted from expected, need to invert the balances
        if (Math.sign(this.last_balances.balance) != Math.sign(this.ctx.amount.value))
            return -1
        return 1
    }
    get_inconsistency() {
        console.assert(!this.is_top_level, "relevant only for sub-table")
        const sign = this.get_relative_sign()
        let v
        if (sign > 0)
            v = this.last_balances.balance - this.ctx.amount.value
        else 
            v = this.last_balances.balance + this.ctx.amount.value
        return (Math.abs(v) < 0.0099) ? 0 : v
    }
    trigger_balance() {
        this.ctx.trigger_balance()
    }
    update_balance(b = null) {
        if (this.is_top_level)
            console.assert(b !== null)
        else { // balances of sub-table are separete
            console.assert(b === null)
            b = new Balances(0, 0, 0)
        }
        
        for(const e of this.entries)
            e.update_balance(b)
        this.last_balances = b.clone()
        this.update_footer()
    }
    tags_balance(tb) {
        let sign = this.get_relative_sign()

        for(const e of this.entries)
            e.tags_balance(tb, sign)
        if (!this.is_top_level) {
            const diff = this.get_inconsistency()
            // if there's an inconsistency between the sum of the sub-entries and the value of the top-level entry
            // add the diff on -1 tag on the right sign
            if (diff != 0)
                tb.add_for_tag(null, diff)
        }
    }
}

class BalanceEntry extends Obj
{
    constructor(ctx, amount_v) {
        super(ctx)
        this.amount = new EntryNumValue(this, "init_balance", amount_v)
        this.amount.change_cb = ()=>{ this.trigger_balance() }
        this.elem = null
    }
    static from_json(ctx, j_v) {
        if (!j_v)
            j_v = 0
        return new BalanceEntry(ctx, j_v)
    }
    to_json() {
        return this.amount.value
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, "obj_balance_entry")
        const spacer = add_div(this.elem, "balance_ent_spacer")
        spacer.innerText = "התחלתית:"
        this.amount.show(this.elem)
    }
    trigger_balance() {
        this.ctx.trigger_balance()
    }
}

class Entry extends Obj
{
    static FIELDS = [{name:"date", disp:"תאריך"}, 
              {name:"bank_desc", disp:"תיאור מהבנק"}, 
              {name:"amount", disp:"סכום"}, 
              {name:"note", disp:"הערה"},
              {name:"balance", disp:"יתרה"}]

    constructor(ctx, date_v, amount_v, bank_desc_v, note_v, tag_id_v, balance=0) {
        super(ctx)
        this.date = new EntryDateValue(this, "date", date_v)
        this.amount = new EntryNumValue(this, "amount", amount_v)
        this.amount.change_cb = ()=>{ this.trigger_balance() }
        this.category = null
        this.bank_desc = new EntryBidiTextValue(this, "bank_desc", bank_desc_v)
        this.note = new EntryTextValue(this, "note", note_v)
        this.tag = new EntryTagValue(this, tag_id_v)
        this.tag.change_cb = ()=>{ this.trigger_balance() }
        this.breakdown = null // optional Table
        this.balance = balance // balance after this transaction

        this.fields = [this.date, this.bank_desc, this.amount, this.note, this.tag]
        this.elem = null
        this.balance_elem = null
        this.expand_btn = null
    }

    static from_json(ctx, j) {
        if (j.amount === null || j.amount === undefined) {
            console.log("bad Entry in state, discarding")
            return null
        }
        const date = parseDate(j.date)
        const e = new Entry(ctx, date, j.amount, j.bank_desc, j.note, j.tag_id)
        if (j.breakdown)
            e.breakdown = Table.from_json(e, j.breakdown)
        return e
    }
    to_json() {
        const d = { date: this.date.to_string(), 
                    amount: this.amount.value, 
                    bank_desc: this.bank_desc.value, 
                    note: this.note.value,
                    tag_id: this.tag.tag_id
                  }
        if (this.breakdown !== null)
            d.breakdown = this.breakdown.to_json()
        return d
    }
    has_breakdown() {
        return this.breakdown !== null && this.breakdown.size() > 0
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        let line_elem;
        if (this.ctx.is_top_level) 
        {
            this.elem = add_div(parent, "obj_entry_cont")
            line_elem = add_div(this.elem, "obj_entry")
            this.expand_btn = add_div(line_elem, "entry_expand")
            this.expand_btn.addEventListener("click", ()=>{
                this.show_expanded_breakdown()
            })
            if (this.has_breakdown()) {
                this.breakdown.show(this.elem)
                this.expand_btn.setAttribute("checked", true)
            }
            this.update_has_breakdown()
        } 
        else {
            line_elem = this.elem = add_div(parent, "obj_entry")
        }
        
        for(const f of this.fields) {
            f.show(line_elem)
        }
        if (this.ctx.is_top_level) {
            this.balance_elem = add_div(line_elem, ["obj_val_value", "entry_balance", "number_label"])
            this.balance_elem.innerText = roundAmount(this.balance)
        }
        const remove_btn = add_div(line_elem, "entry_remove")
        remove_btn.addEventListener("click", ()=>{
            this.ctx.remove_entry(this)
            this.trigger_balance()
        })
    }
    show_expanded_breakdown() {
        if (this.breakdown === null) {
            this.breakdown = new Table(this)
        }
        if (this.expand_btn.getAttribute("checked") === null) {
            this.breakdown.show(this.elem)
            this.expand_btn.setAttribute("checked", true)
        }
        else {
            this.breakdown.hide()
            this.expand_btn.removeAttribute("checked")
        }
    }
    update_has_breakdown() {
        if (this.has_breakdown())
            this.expand_btn.setAttribute("has_breakdown", true)
        else
            this.expand_btn.removeAttribute("has_breakdown")
    }

    update_balance(b) { // update_balance go down the tree
        const v = this.amount.value
        this.balance = b.balance + v
        if (this.balance_elem)
            this.balance_elem.innerText = roundAmount(this.balance)
        b.balance = this.balance
        if (v > 0)
            b.plus += v
        else
            b.minus += v
        if (this.breakdown !== null)
            this.breakdown.update_balance()
    }
    trigger_balance() { // trigger_balance go up the tree
        this.ctx.trigger_balance()
    }
    tags_balance(tb, sign) {
        if (!this.has_breakdown()) {
            const v = sign * this.amount.value
            tb.add_for_tag(this.tag.tag, v)
        }
        else {
            this.breakdown.tags_balance(tb, sign)
        }
    }
}

class EntryTextValue extends Obj
{
    constructor(ctx, name, value) {
        super(ctx)
        this.name = name
        this.value = value
        this.change_cb = null

        this.elem = null
        this.value_elem = null
        this.input_elem = null
    }
    load_value(v) {
        this.value = roundAmountNum(v)
        const s = this.to_string(this.value)
        this.input_elem.value = s
        this.set_value_elem(s)
    }
    from_string(v) {
        this.value = v
    }
    to_string() {
        return this.value
    }
    set_value_elem(v) {
        this.value_elem.innerText = v
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, ["obj_txt_val", "obj_val_" + this.name])
        this.value_elem = add_div(this.elem, ["obj_val_value", "obj_val_val_" + this.name])
        const value_s = this.to_string(this.value)
        this.set_value_elem(value_s)
        this.input_elem = add_elem(this.elem, "input", ["obj_val_input", "obj_val_inp_" + this.name])
        this.input_elem.type = "text"
        this.input_elem.spellcheck = false
        this.input_elem.value = value_s
        this.value_elem.addEventListener("click", ()=>{
            this.input_elem.style.visibility = "visible"
            this.input_elem.focus()
        })
        this.input_elem.addEventListener("input", ()=>{
            this.from_string(this.input_elem.value)
            this.set_value_elem(this.to_string(this.value))
            if (this.change_cb)
                this.change_cb(this.value)
            save_db()
        })
        const hide_input = ()=>{
            this.input_elem.style.visibility = "hidden"
        }
        this.input_elem.addEventListener("blur", hide_input)
        this.input_elem.addEventListener("keydown", (ev)=>{
            if(ev.key === 'Enter')
                hide_input()
        })
    }
}

class EntryNumValue extends EntryTextValue {
    constructor(ctx, name, value) {
        super(ctx, name, value)
    }
    from_string(v) {
        if (v.length == 0)
            this.value = 0
        else
            this.value = parseFloat(v)
    }
    to_string() {
        return roundAmount(this.value)
    }
    show(parent) {
        super.show(parent)
        this.value_elem.classList.add("number_label")
        this.input_elem.classList.add("number_edit")
    }
}

class EntryDateValue extends EntryTextValue {
    constructor(ctx, name, value) {
        super(ctx, name, parseDate(value))
    }
    from_string(v) {
        this.value = parseDate(v)
    }
    to_string() {
        if (this.value === null)
            return "[null]"
        return "" + this.value.getDate() + "/" + (this.value.getMonth() + 1) + "/" + this.value.getFullYear()
    }
}

class EntryBidiTextValue extends EntryTextValue {
    set_value_elem(v) {
        this.value_elem.innerText = v
        if (all_english(v))
            this.value_elem.classList.add("dir_ltr")
        else
            this.value_elem.classList.remove("dir_ltr")
    }
}

class TagTextValue extends EntryTextValue {
    set_value_elem(v) {
        // the text of the tag is already set by the callback which sets the css content
    }
}

class EntryTagValue extends Obj {
    constructor(ctx, tag_id) {
        super(ctx)
        if (!tag_id || tag_id == -1) {
            this.tag_id = -1
            this.tag = null
        }
        else {
            this.tag_id = tag_id
            this.tag = g_db.tags.get_by_id(tag_id)
            if (this.tag === null)
                this.tag_id = -1
        }
        
        this.elem = null
    }

    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, ["tag_value", "obj_txt_val"])
        Tag.emplace(this.tag, this.elem)

        this.elem.addEventListener("click", (ev)=>{
            ev.stopPropagation() // prevent the document handler from dismissing the menu
            g_db.tags.tags_menu(this.elem, (tag)=>{
                this.tag = tag
                this.tag_id = Tag.get_id(tag)
                Tag.emplace(tag, this.elem)
                if (this.change_cb)
                    this.change_cb(this.value)
                save_db()
            })
        })

    }
}

class TagsEditor extends Obj
{
    constructor(ctx) {
        super(ctx)
        this.tags = []
        this.id_gen = 1
        this.elem = null
        this.tag_by_id = {}
        this.tags_menu_elem = null
    }
    static from_json(ctx, j) {
        const t = new TagsEditor(ctx)
        if (!j || !j.tags)
            return t
        t.tags = arr_from_json(t, j.tags, Tag)

        let max_id = 1
        for(const tg of t.tags) {
            max_id = Math.max(max_id, tg.id)
            t.reg_id(tg)
        }
        t.id_gen = max_id + 1
        return t
    }
    reg_id(t) {
        if (this.tag_by_id[t.id] !== undefined)
            console.error("same id to multiple tags")
        this.tag_by_id[t.id] = t
    }
    to_json() {
        return { tags: arr_to_json(this.tags) }
    }
    get_by_id(id) {
        const t = this.tag_by_id[id]
        if (t === undefined) // can happen if tag was removed from tags list but is still referenced
            return null
        return t
    }
    remove_tag(tag) {
        const idx = this.tags.indexOf(tag)
        this.tags.splice(idx, 1)
        removeElem(tag.elem)
        save_db()
        this.create_tags_menu()
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, ["obj_tags"])
        const tags_elem = add_div(this.elem, "tags_cont")
        for(const t of this.tags)
            t.show(tags_elem)
        add_push_btn(this.elem, "הוסף טאג", ()=>{
            const t = new Tag(this, "אין ערך", "#aaaaaa", this.id_gen)
            this.id_gen += 1
            this.tags.push(t)
            this.reg_id(t)
            save_db()
            t.show(tags_elem)
            this.create_tags_menu()
        })
    }
    create_tags_menu() {
        this.tags_menu_elem = add_div(body, ["tags_menu", "hidden"])
        const none_lbl = add_div(this.tags_menu_elem, ["obj_val_val_tag", "tag_menu_label"])
        Tag.emplace(null, none_lbl, true)
        none_lbl.addEventListener("click", ()=>{ this.tags_menu_elem.select_cb(null) })
        for(const t of this.tags) {
            const lbl = add_div(this.tags_menu_elem, ["obj_val_val_tag", "tag_menu_label"])
            Tag.emplace(t, lbl)
            lbl.addEventListener("click", (ev)=>{ this.tags_menu_elem.select_cb(t) })
        }
        document.addEventListener("click", ()=>{
            hide(this.tags_menu_elem, true)
        })
    }
    tags_menu(parent, select_cb) {
        if (this.tags_menu_elem === null)
            this.create_tags_menu()
        hide(this.tags_menu_elem, false)
        const rect = parent.getBoundingClientRect()
        this.tags_menu_elem.style.top = rect.top + "px"
        this.tags_menu_elem.style.left = rect.left + "px"
        this.tags_menu_elem.select_cb = (tag)=>{
            select_cb(tag)
            this.tags_menu_elem.select_cb = null
            hide(this.tags_menu_elem, true)
        }
    }
}

function get_text_color(is_dark) {
    return is_dark ? "#ffffff" : "#000000"
}

class Tag extends Obj
{
    constructor(ctx, value, color, id) {
        super(ctx)
        this.value = new TagTextValue(this, "tag", value)
        this.value.change_cb = ()=>{ this.update_css() }
        this.color = color
        this.id = id
        this.elem = null
        this.text_color = get_text_color(ColorPicker.parse_hex(this.color).is_dark)
    
        let idx = document.styleSheets[0].insertRule('.tag[tag_id="' + this.id + '"] { background-color: initial; }')
        this.css_rule = document.styleSheets[0].cssRules[idx]
        idx = document.styleSheets[0].insertRule('.tag[tag_id="' + this.id + '"]::after { content: ""; }')
        this.css_content_rule = document.styleSheets[0].cssRules[idx]
        this.update_css()
    }
    static from_json(ctx, j) {
        return new Tag(ctx, j.value, j.color, j.id)
    }
    to_json() {
        return { value: this.value.value, color: this.color, id: this.id }
    }
    static emplace(tag, e, mark_none=false) {
        e.classList.add("tag")
        if (tag !== null) {
            e.classList.add("tag_value_has")
            e.setAttribute("tag_id", tag.id)
        }
        else {
            if (mark_none) { // entry don't want this
                e.setAttribute("tag_id", -1)
                e.classList.add("tag_value_has")
            }
            else {
                e.removeAttribute("tag_id")
                e.classList.remove("tag_value_has")
            }
        }
    }

    static get_id(tag) {
        return (tag !== null) ? tag.id : -1 
    }

    update_css() {
        this.css_rule.style.backgroundColor = this.color
        this.css_rule.style.color = this.text_color
        this.css_content_rule.style.content = '"' + this.value.value + '"'
    }
    show(parent) { // in editor
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, "obj_tag", "tag")
        this.value.show(this.elem)
        Tag.emplace(this, this.value.value_elem)
        const color_edit = add_elem(this.elem, "input", "tag_color")
        ColorEditBox.create_at(color_edit, 150, (c)=>{
            this.color = c.hex
            this.text_color = get_text_color(c.is_dark)
            this.update_css()
            save_db()
        }, {}, this.color)
        const remove_btn = add_div(this.elem, "entry_remove")
        remove_btn.addEventListener("click", ()=>{ this.ctx.remove_tag(this) })
    }
}

function all_english(s) {
    let has_eng = false
    let has_non_eng = false
    for(let i = 0; i < s.length; ++i) {
        const c = s.charAt(i)
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
            has_eng = true
            continue
        }
        const cc = s.charCodeAt(i)
        if (cc > 0xff)
            has_non_eng = true
    }
    return has_eng && !has_non_eng
}

function parseDate(s, sep="/") {
    if (s === null)
        return null
    if (s instanceof Date)
        return s
    const date_sp = s.split(sep)
    if (date_sp.length != 3)
        return null
    try {
        const day = checkParseInt(date_sp[0])
        const monthIndex = checkParseInt(date_sp[1]) - 1
        let year = checkParseInt(date_sp[2])
        if (year < 100)
            year += 2000
        return new Date(year, monthIndex, day)
    }
    catch(err) {
        return null
    }
}


function dlg_statement(parent, table)
{
    const rect = {visible:true}
    const close_action = ()=> { parent.removeChild(dlg.elem)}
    const dlg = create_dialog(parent, "Statement", true, rect, close_action)
    dlg.elem.classList.add("stmt_dlg")
    const ed_elem = add_div(dlg.client, "stmt_center")
    const txt_elem = add_elem(ed_elem, "textarea", "stmt_text")

    let parser = null
    const buttons = add_div(dlg.client, "dlg_buttons_group")
    const sb = add_push_btn(buttons, "Add Entries", ()=>{ 
        if (parser !== null)
            parser.add_entries(txt_elem.value) 
        close_action(); 
    })
    sb.classList.add("dlg_button")
    const cb = add_push_btn(buttons, "Cancel", close_action)    
    cb.classList.add("dlg_button")

    ed_elem.addEventListener("drop", (ev)=>{
        console.log("File dropped");
        ev.preventDefault();
        if (ev.dataTransfer.files.length != 1) {
            console.error("unexpected drop")
            return
        }
        const file = ev.dataTransfer.files[0]
        const reader = new FileReader();
        reader.onload = (rdev) => {
            const in_buf = rdev.target.result
            const in_txt = new TextDecoder("utf-8").decode(in_buf)
            for(const p_cls of g_parser_clss)
                if (p_cls.identify(in_txt))
                    parser = new p_cls(table)
            if (parser === null) {
                console.error("Did not identify file")
                return
            }
            txt_elem.value = parser.parse_stmt_file(in_txt, in_buf)
        };
        reader.readAsArrayBuffer(file);
    })
    ed_elem.addEventListener("dragover", (ev)=>{
        
    })
}

class ParserBase {
    constructor(table) {
        this.table = table
        this.card_num = null
    }
    add_entries(txt, reverse) {
        const lines = txt.split("\n")
        const entries = []
        for(const line of lines) {
            try {
                const cells = line.split("|")
                const e = this.parse_line(cells)
                if (e)
                    entries.push(e)
            }
            catch(err) {
                console.error(err)
            }
        }
        if (entries.length == 0)
            return
        if (reverse)
            entries.reverse() // it comes newest first
        const was_empty = this.table.size() == 0
        for(const e of entries)
            this.table.add_entry(e, false)
        if (was_empty && this.table.is_top_level) {
            const first_entry = entries[0]
            this.table.ctx.initial_balance.amount.load_value(first_entry.balance - first_entry.amount.value)
        }
        save_db()
        this.table.trigger_balance()
    }

    check_card(card_num) {
        if (this.card_num === null)
            this.card_num = card_num
        else if (this.card_num != card_num)
            throw new Error("Wrong card " + this.card_num + ", " + card_num)
    }
    amount_plus_minus(plus_amount, minus_amount) {
        if (plus_amount == 0 && minus_amount == 0)
            throw new Error("line with 0 amount?")
        if (plus_amount != 0 && minus_amount != 0) 
            throw new Error("line with 2 amounts?")
        return plus_amount - minus_amount
    }
}

class ParserLeumiHtml extends ParserBase {
    constructor(table) {
        super(table)
    }
    static identify(txt) {
        return txt.startsWith("<html") && txt.includes("leumi")
    }
    parse_stmt_file(in_txt)
    {
        const frame = create_elem("div");
        frame.innerHTML  = in_txt
        let s_txt = ""
        let in_table = false
        let added_space = false
        let added_nl = true
        const rec_parse = (node)=>{
            if (node.nodeType == Node.ELEMENT_NODE) {
                if (node.tagName == "STYLE")
                    return
                let table_div = false
                if (node.tagName == "DIV") {
                    const role = node.getAttribute("role")
                    if (role == "table") {
                        in_table = true
                        table_div = true
                    }
                    if (in_table && role == "row" && !added_nl) {
                        s_txt += "\n"
                        added_nl = true
                    }
                }

                for(const ch of node.childNodes)
                    rec_parse(ch)

                if (table_div)
                    in_table = false // table div ended
            }
            else if (node.nodeType == Node.TEXT_NODE && in_table) {
                if (node.nodeValue.length == 0)
                    return
                const chunk = node.nodeValue.trim()
                if (chunk.length == 0) {
                    if (added_space)
                        return
                    s_txt += "|"
                    added_space = true
                    return
                }
                s_txt += node.nodeValue
                added_space = false
                added_nl = false
            }
        }
        rec_parse(frame)
        return s_txt
    }

    parse_line(cells) {
        if (cells.length < 7 || cells[0].length == 0 || isNaN(cells[0].charAt(0)))
            return null // title line
        const date = parseDate(cells[0], '/')
        const bank_desc = cells[2]
        const minus_amount = checkParseAmount(cells[4])
        const plus_amount = checkParseAmount(cells[5])
        const amount = this.amount_plus_minus(plus_amount, minus_amount)
        const balance = checkParseAmount(cells[6])
        const e = new Entry(null, date, amount, bank_desc, "", null, balance)
        // balance is temporary, for calculating initial_balance, will be overwritten the first update_balance
        return e
    }
    add_entries(txt) {
        super.add_entries(txt, true)
    }
}

class MaxEntrier extends ParserBase
{
    parse_line(cells) {
        if (cells.length < 10 || isNaN(cells[0].charAt(0)) || cells[0].split('-').length != 3)
            return null
        const date = parseDate(cells[0], "-")
        const bank_desc = cells[1]
        const card_num = cells[3]
        this.check_card(card_num)
        const amount_s = cells[5]
        const amount = checkParseAmount(amount_s)
        const total_amount_s = cells[7]
        const total_ccy = cells[8]
        let note = ""
        if (cells.length > 10)
            note = dequote(cells[10])
        if (amount_s != total_amount_s)
            note += "(" + total_amount_s + total_ccy + ")"
        const e = new Entry(null, date, amount, bank_desc, note, null, 0)
        return e
    }
    add_entries(txt) {
        super.add_entries(txt, false)
    }
}

class ParserMaxSheet extends MaxEntrier
{
    constructor(table) {
        super(table)
    }
    static identify(txt) {
        return txt.startsWith("<?xml") && txt.includes("spreadsheetml")
    }
    parse_stmt_file(in_txt)
    {
        const parser = new DOMParser();
        const doc = parser.parseFromString(in_txt, "text/xml");
        let s_txt = ""
        let added_text = false
        const rec_parse = (node)=>{
            if (node.nodeType == Node.ELEMENT_NODE) {
                if (node.tagName == "row") {
                    s_txt += "\n"
                    added_text = false
                }
                for(const ch of node.childNodes)
                    rec_parse(ch)
            }
            else if (node.nodeType == Node.TEXT_NODE) {
                if (added_text)
                    s_txt += "|"
                s_txt += node.nodeValue
                added_text = true
            }
        }
        rec_parse(doc.documentElement);
        return s_txt
    }
}

class PoalimEntrier extends ParserBase
{
    parse_line(cells) {
        if (cells.length < 9 || isNaN(cells[0].charAt(0)))
            return null
        const date = parseDate(cells[0], '/')
        const bank_desc = cells[1]
        const plus_amount = checkParseAmount(cells[5])
        const minus_amount = checkParseAmount(cells[4])
        const amount = this.amount_plus_minus(plus_amount, minus_amount)
        const note = cells[2]
        const balance = checkParseAmount(cells[6])
        const e = new Entry(null, date, amount, bank_desc, note, null, balance)
        return e
    }
    add_entries(txt) {
        super.add_entries(txt, true)
    }
}

class MasterCardEntrier extends ParserBase
{
    parse_line(cells) {
        if (cells.length < 7 || cells[1].split('/').length != 3)
            return null
        this.check_card(cells[0])
        const date = parseDate(cells[2], '/')
        const bank_desc = dequote(cells[3])
        const amount = checkParseAmount(cells[5])
        const e = new Entry(null, date, amount, bank_desc, "", null, 0)
        return e
    }
    add_entries(txt) {
        super.add_entries(txt, false)
    }
}

class XlsxParser extends ParserBase
{
    constructor(table) {
        super(table)
        this.card_num = null
        this.entryer = null
    }
    static identify(txt) {
        return txt.startsWith("PK")
    }
    parse_stmt_file(in_txt, in_buf) {
        const workbook = XLSX.read(in_buf, {cellDates:true})
        if (!workbook)
            return "Failed reading"

        let s_txt = ""
        for(const sheet_name in workbook.Sheets) {
            const sheet = workbook.Sheets[sheet_name]
            const txt = XLSX.utils.sheet_to_csv(sheet, {FS:'|', dateNF:"dd/mm/yyyy"})
            s_txt += txt
        }
        if (workbook.Props && workbook.Props.Company == "Bank Hapoalim") {
            if (s_txt.includes("שם כרטיס"))
                this.entryer = new MasterCardEntrier(this.table)
            else if (s_txt.includes("תנועות בחשבון"))
                this.entryer = new PoalimEntrier(this.table)
            else
                return "Unknown Hapoalim producer"
        }
        else if (workbook.Props && workbook.Props.Application == "SheetJS")
            this.entryer = new MaxEntrier(this.table)
        else 
            return "Unknown Excel producer"
        return s_txt
    }
    add_entries(txt) {
        if (this.entryer === null)
            return
        this.entryer.add_entries(txt)
    }
}


const g_parser_clss = [ParserLeumiHtml, ParserMaxSheet, XlsxParser]



function page_onload()
{
    g_db = new Database(null)
    load_db()

    g_db.show(body)
}