"use strict";

function create_elem(elem_type, cls) {
    const e = document.createElement(elem_type);
    if (cls !== undefined && cls !== null) {
        if (!Array.isArray(cls))
            cls = [cls]
        e.classList = cls.join(" ")
    }
    return e
}
function add_elem(parent, elem_type, cls) {
    const e = create_elem(elem_type, cls)
    parent.appendChild(e)
    return e
}
function create_div(cls) {
    return create_elem('div', cls)
}

function add_div(parent, cls) {
    const e = create_div(cls)
    parent.appendChild(e)
    return e
}
function add_span(parent, cls) {
    return add_elem(parent, "span", cls)
}

function add_push_btn(parent, label, onclick, cls=null) {
    if (cls === null)
        cls = "param_btn"
    else {
        if (Array.isArray(cls))
            cls = cls.concat(["param_btn"])
        else
            cls = [cls, "param_btn"]
    }
    let btn = add_div(parent, cls)
    btn.innerText = label
    if (onclick !== null)
        btn.addEventListener("click", onclick)
    return btn
}

function add_checkbox(parent, label, init_v, onchange, cls=null) {
    const lbl = add_elem(parent, "label", "param_checkbox_lbl")
    lbl.innerText = label
    if (cls !== null)
        lbl.classList.add(cls)
    const check_box = create_elem("input", "param_checkbox_inp")
    check_box.setAttribute("type", "checkbox")
    check_box.checked = init_v
    lbl.insertBefore(check_box, lbl.firstChild)
    check_box.addEventListener("change", (v)=>{ onchange(check_box.checked) })
    return {label: lbl, inp: check_box}
}


function create_dialog(parent, title, resizable, rect, visible_changed, size_changed=null)
{
    const dlg = add_div(parent, "dlg")
    if (!rect)
        rect = {left:null, top:null, width:null, height:null, visible:false}
    dlg.style.display = 'none'

    const title_line = add_div(dlg, "dlg_title")
    const title_text = add_elem(title_line, 'span', 'dlg_title_text')
    title_text.innerText = title
    const close_btn = add_div(title_line, "dlg_close_btn")

    const set_visible = (v) => {
        if (v == rect.visible)
            return
        rect.visible = v;
        if (visible_changed)
            visible_changed(rect.visible)
        repos()
    }
    close_btn.addEventListener('click', () => {
        set_visible(false)
    })
    const client = add_div(dlg, "dlg_client")


    const set_title = (v) => {
        title_text.innerText = v
    }

    const repos = () => {
        if (rect.left) {
            dlg.style.left = rect.left + "px"
            dlg.style.top =  rect.top + "px"
        }
        if (rect.width) {
            rect.width = Math.max(rect.width, 150)
            rect.height = Math.max(rect.height, 150)
            dlg.style.width = rect.width + "px"
            dlg.style.height = rect.height + "px"
        }
        dlg.style.display = rect.visible ? '' : 'none'
    }
    repos()

    const move_coord_limited = (rect, curstyle, name, d, max_v, min_v) => {
        if (rect[name] === null || rect[name] === undefined || isNaN(rect[name]))
            rect[name] = parseInt(curstyle[name])
        const track_name = "track_" + name
        if (rect[track_name] === null || rect[track_name] === undefined || isNaN(rect[track_name]))
            rect[track_name] = rect[name]
        rect[track_name] = rect[track_name] + d  // tracking the mouse even if it goes negative
        rect[name] = Math.min(Math.max(rect[track_name], min_v), max_v)
    }

    const move_func = (dx, dy) => {
        const curstyle = window.getComputedStyle(dlg)
        move_coord_limited(rect, curstyle, "left", dx, window.innerWidth - 40, 0)       
        move_coord_limited(rect, curstyle, "top", dy, window.innerHeight - 40, 0)
        repos()
    }
    const start_move_func = ()=>{
        rect.track_top = null
        rect.track_left = null
        rect.track_width = null
        rect.track_height = null
    }
    add_move_handlers(title_line, move_func, start_move_func)


    if (resizable) {
        let r_resize = add_div(dlg, "dlg_resize_r")
        let l_resize = add_div(dlg, "dlg_resize_l")
        let b_resize = add_div(dlg, "dlg_resize_b")

        let rb_resize = add_div(dlg, "dlg_resize_rb")
        let lb_resize = add_div(dlg, "dlg_resize_lb")

        let resize_func =  (dx,dy) => {
            let curstyle = window.getComputedStyle(dlg)
            move_coord_limited(rect, curstyle, "width", dx, window.innerWidth - 40, 150)
            move_coord_limited(rect, curstyle, "height", dy, window.innerWidth - 40, 150)       
            repos()
            if (size_changed !== null)
                size_changed()            
        }
        add_move_handlers(rb_resize, resize_func)
        add_move_handlers(lb_resize, (dx, dy)=>{resize_func(-dx,dy); move_func(dx,0)})
        add_move_handlers(r_resize, (dx, dy)=>{resize_func(dx, 0)})
        add_move_handlers(l_resize, (dx, dy)=>{resize_func(-dx, 0); move_func(dx, 0)})
        add_move_handlers(b_resize, (dx, dy)=>{resize_func(0, dy)})
        if (size_changed !== null)
            size_changed()        
    }
    rect.elem = dlg
    rect.client = client
    rect.set_visible = set_visible
    return rect
}

// generic function to handle all cases of dragging some UI element
function add_move_handlers(grip, movefunc, downfunc=null) {
    let moving = false;
    let prevx, prevy;

    const moveHandler = function(e) {
        if (!moving) 
            return
        e.preventDefault(); // prevent selection action from messing it up
        let dx = e.pageX - prevx, dy = e.pageY - prevy
        if (dx == 0 && dy == 0)
            return
        movefunc(dx, dy, e.pageX, e.pageY)
        prevx = e.pageX; prevy = e.pageY
    }
    const ev = {move:null, up:null}
    const upHandler = function() {
        moving = false;
        document.removeEventListener('mousemove', ev.move)
        document.removeEventListener('mouseup', ev.up)
        ev.move = null
        ev.up = null
    }
    grip.addEventListener('mousedown', function(e) {
        if (e.buttons != 1)
            return
        moving = true;
        if (downfunc)
            downfunc(e.pageX, e.pageY, e)
        prevx = e.pageX; prevy = e.pageY
        ev.move = document.addEventListener('mousemove', moveHandler);
        ev.up = document.addEventListener('mouseup', upHandler);
    });
}

// an input dialog with input fields
function fields_input_dlg(parent, caption, text, on_save_func)
{
    const rect = {visible:true}
    const close_action = ()=> { parent.removeChild(dlg.elem)}
    const dlg = create_dialog(parent, caption, false, rect, close_action)
    dlg.elem.classList.add("dlg_size_save_as")
    if (text !== null) {
        const label = add_div(dlg.client, "dlg_label")
        label.innerText = text
    }
    const center_elem = add_div(dlg.client, "dlg_center")

    const buttons = add_div(dlg.client, "dlg_buttons_group")
    const sb = add_push_btn(buttons, "Save", ()=>{ on_save_func(); close_action(); })
    sb.classList.add("dlg_button")
    const cb = add_push_btn(buttons, "Cancel", close_action)    
    cb.classList.add("dlg_button")
    return {dlg:dlg, center_elem:center_elem}
}

function input_dlg(parent, caption, text, on_save_func) 
{
    let name_input = null
    const d = fields_input_dlg(parent, caption, text, ()=>{on_save_func(name_input.value)})
    name_input = add_elem(d.center_elem, "input", "dlg_text_input")
    name_input.type = "text"
    name_input.spellcheck = false
}

function message_box(parent, title, text, opts) 
{
    const rect = {visible:true}
    const close_action = ()=> { parent.removeChild(dlg.elem)}
    const dlg = create_dialog(parent, title, false, rect, close_action)
    const label = add_div(dlg.client, "dlg_label")
    label.innerText = text
    
    const buttons = add_div(dlg.client, "dlg_buttons_group")
    for(let opt of opts) {
        const sb = add_push_btn(buttons, opt.text, ()=>{ 
            if (opt.func)
                opt.func()
            close_action();
        })
        sb.classList.add("dlg_button")
    }
    return dlg
}
