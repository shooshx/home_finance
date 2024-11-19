
"use strict";


let g_db = null
let g_periods_elem = null
let g_accounts_elem = null

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
function roundAmount(n) {
    return Math.round(n * 100)/100
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
        this.elem.parentElement.removeChild(this.elem) 
        this.elem = null
    }
}

class Database extends Obj
{
    constructor(ctx) {
        super(ctx)
        this.periods = []
        this.selected_period_idx = 0
    }
    static from_json(ctx, j) {
        const db = new Database(ctx)
        db.periods = arr_from_json(db, j.periods, Period)
        if (j.selected_period_idx)
            db.selected_period_idx = j.selected_period_idx
        return db
    }
    to_json() {
        return { periods: arr_to_json(this.periods), selected_period_idx: this.selected_period_idx }
    }
}

class Period extends Obj
{
    constructor(ctx, name) {
        super(ctx)
        this.name = name
        this.accounts = []
        this.elem = null
        this.accounts_elem = null
    }
    static from_json(ctx, j) {
        const p  = new Period(ctx, j.name)
        p.accounts = arr_from_json(p, j.accounts, Account)
        return p
    }
    to_json() {
        return { name: this.name, accounts: arr_to_json(this.accounts) }
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.accounts_elem = add_div(parent, "period_accounts")
        for(const a of this.accounts) {
            a.show(this.accounts_elem)
        }
        add_push_btn(parent, "Add Account...", ()=>{
            input_dlg(body, "Input", "Account Name", (v)=>{
                const a = new Account(this, v)
                this.accounts.push(a)
                save_db()
                a.show(this.accounts_elem)
            }) 
        })
    }
    remove_account(account) {
        const idx = this.accounts.indexOf(account)
        this.accounts.splice(idx, 1)
        this.accounts_elem.removeChild(account.elem)
        save_db()
    }
}

class Account extends Obj
{
    constructor(ctx, name) {
        super(ctx)
        this.name = name
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
        return { name:this.name, 
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
        const name_elem = add_div(title_elem, "account_title_name")
        name_elem.innerText = this.name
        const remove_btn = add_div(title_elem, "entry_remove")
        remove_btn.addEventListener("click", ()=>{
            this.ctx.remove_account(this)
        })
        // needed so that table can recreate itself by deleting it's elem
        const table_wrap = add_div(this.elem)
        this.table.show(table_wrap)
        add_push_btn(this.elem, "Add Entry...", ()=>{
            this.table.add_empty_entry()
            a.trigger_balance()
        })
        add_push_btn(this.elem, "Paste Statement...", ()=>{
            dlg_statement(body, this)
        })
        add_push_btn(this.elem, "Clear", ()=>{
            this.table.clear()
            this.table.show(table_wrap)
        })
    }
    trigger_balance() {
        this.table.update_balance(this.initial_balance.amount.value)
    }
} 

class Table extends Obj
{
    constructor(ctx) {
        super(ctx)
        this.entries = []
        this.is_top_level = (this.ctx.constructor == Account)
        this.elem = null
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
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, "obj_table")
        const header = add_div(this.elem, "table_header")
        for(const f of Entry.FIELDS)
            add_div(header, ["table_hdr_field", "obj_val_hdr_" + f.name]).innerText = f.disp
        
        if (this.is_top_level) {
            this.ctx.initial_balance.show(this.elem)
        }
        for(const e of this.entries)
            e.show(this.elem)
    }

    add_empty_entry() {
        this._add_entry(new Entry("ריק", "0", "ריק", "")) 
    }
    add_entry(entry) { // to the end
        entry.ctx = this
        this.entries.push(entry)
        if (this.elem !== null)
            entry.show(this.elem)
        save_db()
    }
    remove_entry(entry) {
        const idx = this.entries.indexOf(entry)
        this.entries.splice(idx, 1)
        this.elem.removeChild(entry.elem)
        save_db()
    }
    update_balance(balance) {
        for(const e of this.entries)
            balance = e.update_balance(balance)
        return balance
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

    constructor(ctx, date_v, amount_v, bank_desc_v, note_v) {
        super(ctx)
        this.date = new EntryDateValue(this, "date", date_v)
        this.amount = new EntryNumValue(this, "amount", amount_v)
        this.amount.change_cb = ()=>{ this.trigger_balance() }
        this.category = null
        this.bank_desc = new EntryTextValue(this, "bank_desc", bank_desc_v)
        this.note = new EntryTextValue(this, "note", note_v)
        this.breakdown = null // optional Table
        this.balance = 0 // balance after this transaction

        this.fields = [this.date, this.bank_desc, this.amount, this.note]
        this.elem = null
        this.balance_elem = null
    }

    static from_json(ctx, j) {
        if (j.amount === null || j.amount === undefined) {
            console.log("bad Entry in state, discarding")
            return null
        }
        const date = parseDate(j.date)
        const e = new Entry(ctx, date, j.amount, j.bank_desc, j.note)
        if (j.breakdown)
            e.breakdown = Table.from_json(e, j.breakdown)
        return e
    }
    to_json() {
        const d = { date:this.date.to_string(), 
                    amount:this.amount.value, 
                    bank_desc:this.bank_desc.value, 
                    note:this.note.value
                  }
        if (this.breakdown !== null)
            d.breakdown = this.breakdown.to_json()
        return d
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, "obj_entry")
        for(const f of this.fields) {
            f.show(this.elem)
        }
        this.balance_elem = add_div(this.elem, ["obj_val_value", "entry_balance"])
        this.balance_elem.innerText = roundAmount(this.balance)
        const remove_btn = add_div(this.elem, "entry_remove")
        remove_btn.addEventListener("click", ()=>{
            this.ctx.remove_entry(this)
        })
    }
    update_balance(balance) { // update_balance go down the tree
        this.balance = balance + this.amount.value
        if (this.balance_elem)
            this.balance_elem.innerText = roundAmount(this.balance)
        return this.balance 
    }
    trigger_balance() { // trigger_balance go up the tree
        if (this.ctx.is_top_level) {
            // if we're an entry in a top-level table, go to the account and update balance
            this.ctx.ctx.trigger_balance()
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
        this.value = roundAmount(v)
        const s = this.to_string(this.value)
        this.input_elem.value = s
        this.value_elem.innerText = s
    }
    from_string(v) {
        this.value = v
    }
    to_string() {
        return this.value
    }
    show(parent) {
        if (this.elem !== null) {
            parent.appendChild(this.elem)
            return
        }
        this.elem = add_div(parent, ["obj_txt_val", "obj_val_" + this.name])
        this.value_elem = add_div(this.elem, "obj_val_value")
        const value_s = this.to_string(this.value)
        this.value_elem.innerText = value_s
        this.input_elem = add_elem(this.elem, "input", ["obj_val_input", "obj_val_" + this.name])
        this.input_elem.type = "text"
        this.input_elem.spellcheck = false
        this.input_elem.value = value_s
        this.value_elem.addEventListener("click", ()=>{
            this.input_elem.style.visibility = "visible"
            this.input_elem.focus()
        })
        this.input_elem.addEventListener("input", ()=>{
            this.from_string(this.input_elem.value)
            this.value_elem.innerText = this.to_string(this.value)
            if (this.change_cb)
                this.change_cb(this.value)
            save_db()
        })
        this.input_elem.addEventListener("blur", ()=>{
            this.input_elem.style.visibility = "hidden"
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
}

class EntryDateValue extends EntryTextValue {
    constructor(ctx, name, value) {
        super(ctx, name, value)
        console.assert(value === null || ((value instanceof Date) && !isNaN(value)))
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

function parseDate(s) {
    if (s === null)
        return null
    if (s instanceof Date)
        return s
    const date_sp = s.split("/")
    if (date_sp.length != 3)
        return null
    try {
        const day = checkParseInt(date_sp[0])
        const monthIndex = checkParseInt(date_sp[1]) - 1
        const year = checkParseInt(date_sp[2])
        return new Date(year, monthIndex, day)
    }
    catch(err) {
        return null
    }
}


function dlg_statement(parent, account)
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
            const in_txt = rdev.target.result;
            for(const p_cls of g_parser_clss)
                if (p_cls.identify(in_txt))
                    parser = new p_cls(account)
            if (parser === null) {
                console.error("Did not identify file")
                return
            }
            txt_elem.value = parser.parse_stmt_file(in_txt)
        };
        reader.readAsText(file);
    })
    ed_elem.addEventListener("dragover", (ev)=>{
        
    })
}

class ParserLeumiHtml {
    constructor(account) {
        this.account = account
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

    parse_line(line) {
        const cells = line.split("|")
        if (cells.length < 7 || cells[0].length == 0 || isNaN(cells[0].charAt(0)))
            return null // title line
        const date_s = cells[0]
        const date_sp = date_s.split("/")
        if (date_sp.length != 3)
            throw new Error("Unexpected date format " + date)
        const day = checkParseInt(date_sp[0])
        const monthIndex = checkParseInt(date_sp[1]) - 1
        const year = checkParseInt(date_sp[2]) + 2000
        const date = new Date(year, monthIndex, day)
        const bank_desc = cells[2]
        const minus_amount = checkParseAmount(cells[4])
        const plus_amount = checkParseAmount(cells[5])
        const balance = checkParseAmount(cells[6])
        if (plus_amount == 0 && minus_amount == 0)
            throw new Error("line with 0 amount?")
        if (plus_amount != 0 && minus_amount != 0) 
            throw new Error("line with 2 amounts?")

        const amount = plus_amount - minus_amount
        const e = new Entry(null, date, amount, bank_desc, "")
        // temporary, for calculating initial_balance, will be overwritten the first update_balance
        e.balance = balance 
        return e
    }

    add_entries(txt) {
        const lines = txt.split("\n")
        const entries = []
        for(const line of lines) {
            try {
                const e = this.parse_line(line)
                if (e)
                    entries.push(e)
            }
            catch(err) {
                console.error(err)
            }
        }
        if (entries.length == 0)
            return
        entries.reverse() // it comes newest first
        const was_empty = this.account.table.size() == 0
        for(const e of entries)
            this.account.table.add_entry(e)
        if (was_empty) {
            const first_entry = entries[0]
            this.account.initial_balance.amount.load_value(first_entry.balance - first_entry.amount.value)
        }
        this.account.trigger_balance()
    }
}

const g_parser_clss = [ParserLeumiHtml]


function selected_period() {
    return g_db.periods[g_db.selected_period_idx]
}

function switch_to_period(index, do_save)
{
    g_db.selected_period_idx = index
    console.log("Switch to period " + selected_period().name)
    show_accounts()
    if (do_save)
        save_db()
}


function add_period_dlg(parent)
{
    input_dlg(parent, "Input", "Period Name", (v)=>{
        g_db.periods.push(new Period(g_db, v))
        g_db.selected_period_idx = g_db.periods.length - 1
        show_periods_selector()
        save_db()
    })
}

function show_periods_selector()
{
    g_periods_elem.innerText = ""
    const se = add_elem(g_periods_elem, "select", "period_combo")
    for(const p of g_db.periods) {
        const o = add_elem(se, 'option')
        o.innerText = p.name
        o.period = p 
    }

    if (g_db.periods.length == 0) {
        const o = add_elem(se, "option")
        o.period = null // add empty so that "Add period..." would generate an event
    }
    const adder = add_elem(se, "option")
    adder.innerText = "Add Period..."
    if (g_db.selected_period_idx !== undefined) {
        if (g_db.selected_period_idx < g_db.periods.length) {
            se.selectedIndex = g_db.selected_period_idx
            switch_to_period(se.selectedIndex, false)
        }
        else {
            delete g_db.selected_period_idx
            se.selectedIndex = 0
        }
    }

    se.addEventListener('input', function() { 
        if (se.selectedIndex == adder.index) {
            se.selectedIndex = 0
            add_period_dlg(body)
            return;
        }
        switch_to_period(se.selectedIndex, true)
    })
}



function show_accounts()
{
    g_accounts_elem.innerText = ""
    const period = selected_period()
    period.show(g_accounts_elem)
}


function page_onload()
{
    g_db = new Database(null)
    load_db()
    g_periods_elem = add_div(body, "period_cont")
    g_accounts_elem =  add_div(body, "accounts_cont")
    show_periods_selector()
    show_accounts()
}