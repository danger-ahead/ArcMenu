/*
 * ArcMenu - A traditional application menu for GNOME 3
 *
 * ArcMenu Lead Developer and Maintainer
 * Andrew Zaech https://gitlab.com/AndrewZaech
 * 
 * ArcMenu Founder, Former Maintainer, and Former Graphic Designer
 * LinxGem33 https://gitlab.com/LinxGem33 - (No Longer Active)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
const Me = imports.misc.extensionUtils.getCurrentExtension();
const {Adw, Gdk, GdkPixbuf, Gio, GLib, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var Button = GObject.registerClass(class Arc_Menu_Button extends Gtk.Button {
    _init(params) {
        super._init();
        this._params = params;
        this.halign = Gtk.Align.END;
        this.valign = Gtk.Align.CENTER;
        this.box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5
        });
        this.set_child(this.box);

        if (this._params.icon_name) {
            let image = new Gtk.Image({
                icon_name: this._params.icon_name,
                halign: Gtk.Align.CENTER
            });
            this.box.append(image);
        }
        if (this._params.tooltip_text){
            this.set_tooltip_text(this._params.tooltip_text);
        }
        if (this._params.title){
            let label = new Gtk.Label({
                label: _(this._params.title),
                use_markup: true,
                xalign: 0
            });
            if(this._params.icon_first)
                this.box.append(label);
            else
                this.box.prepend(label);
        }
    }
});

var DialogWindow = GObject.registerClass({
    Signals: {
        'response': { param_types: [GObject.TYPE_INT]},
    },
},class Arc_Menu_DialogWindow extends Adw.PreferencesWindow {
    _init(title, parent, buttonLocation) {
        super._init({
            title: title,
            transient_for: parent.get_root(),
            modal: true,
            search_enabled: true,
        });
        this.page = new Adw.PreferencesPage();
        this.pageGroup = new Adw.PreferencesGroup();
        this.headerGroup = new Adw.PreferencesGroup();
        this.add(this.page);
        if(buttonLocation === Constants.MenuItemLocation.TOP){
            this.page.add(this.headerGroup);
            this.page.add(this.pageGroup);
        }
        else{
            this.page.add(this.pageGroup);
            this.page.add(this.headerGroup);
        }
    }
});

var DragRow = GObject.registerClass({
    Signals: {
        'drag-drop-done': { },
    },
},class Arc_Menu_DragRow extends Adw.ActionRow {
    _init(params) {
        super._init(params);
        let scrolledWindow = null;

        let dragSource = new Gtk.DragSource({ 
            actions: Gdk.DragAction.MOVE
        });
        this.add_controller(dragSource);

        let dropTarget = new Gtk.DropTargetAsync({ 
            actions: Gdk.DragAction.MOVE
        });
        this.add_controller(dropTarget);

        this.x = 0;
        
        dragSource.connect("drag-begin", (self, gdkDrag) => {
            //get listbox parent
            let listBox = self.get_widget().get_parent();
            //get widgets parent - the listBoxDragRow
            listBox.dragRow = this;

            let alloc = self.get_widget().get_allocation();
            let dragWidget = self.get_widget().createDragRow(alloc);
            listBox.dragWidget = dragWidget;

            let icon = Gtk.DragIcon.get_for_drag(gdkDrag);
            icon.set_child(dragWidget);

            gdkDrag.set_hotspot(listBox.dragX, listBox.dragY);
        });

        dragSource.connect("prepare", (self, x, y) => {
            //get listbox parent
            this.set_state_flags(Gtk.StateFlags.NORMAL, true);
            let listBox = self.get_widget().get_parent();
            //store drag start cursor location
            listBox.dragX = x;
            listBox.dragY = y;
            return new Gdk.ContentProvider(Arc_Menu_DragRow);    
        });

        dragSource.connect("drag-end", (self, gdkDrag, deleteData)=> {
            deleteData = true;
            let listBox = self.get_widget().get_parent();
            listBox.dragWidget = null;
            listBox.drag_unhighlight_row();
        });

        dropTarget.connect("drag-enter", (self, gdkDrop, x, y, selection, info, time)=> {
            let listBox = self.get_widget().get_parent();
            let widget = self.get_widget();

            listBox.startIndex = widget.get_index();
            listBox.drag_highlight_row(widget);
           
            if(!scrolledWindow)
                return true;
            
            let height = widget.get_height();
            let scrollHeight = scrolledWindow.get_height();
            let widgetLoc = widget.get_index() * height;
            let value = scrolledWindow.vadjustment.value;
            
            if((widgetLoc + (height * 4)) > (value + scrollHeight))
                scrolledWindow.vadjustment.value += height;
            else if((widgetLoc - (height * 2)) < value)
                scrolledWindow.vadjustment.value -= height;
        });

        dropTarget.connect("drag-leave", (self, gdkDrop, x, y, selection, info, time)=> {
            let listBox = self.get_widget().get_parent();
            listBox.drag_unhighlight_row();
        });

        dropTarget.connect("drop", (self, gdkDrop, x, y, selection, info, time)=> {
            //get listbox parent
            let listBox = this.get_parent();
            let index = this.get_index();
            if(index === listBox.dragRow.get_index()){
                gdkDrop.read_value_async(Arc_Menu_DragRow, 1, null, () => {
                    gdkDrop.finish(Gdk.DragAction.MOVE);
                });
                return true;
            }
            listBox.remove(listBox.dragRow);
            listBox.show();
            listBox.insert(listBox.dragRow, index);

            gdkDrop.read_value_async(Arc_Menu_DragRow, 1, null, ()=>{
                gdkDrop.finish(Gdk.DragAction.MOVE);
            });
            this.emit("drag-drop-done");
            return true;
        });
    }

    createDragRow(alloc){
        let dragWidget = new Gtk.ListBox();
        dragWidget.set_size_request(alloc.width, alloc.height);

        let dragRow = new Adw.ActionRow();
        dragWidget.append(dragRow);
        dragWidget.drag_highlight_row(dragRow);

        let image = new Gtk.Image( {
            gicon: this._gicon,
            pixel_size: 22
        });
        let dragImage = new Gtk.Image( {
            gicon: Gio.icon_new_for_string("drag-symbolic"),
            pixel_size: 12
        });

        dragRow.add_prefix(image);
        dragRow.add_prefix(dragImage);
        dragRow.title = _(this._name);

        let grid = new Gtk.Grid({
            margin_top: 0,
            margin_bottom: 0,
            vexpand: false,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            column_spacing: 10
        })
        let editButton = new Button({
            icon_name: 'view-more-symbolic'
        });
        grid.attach(editButton, 0, 0, 1, 1);

        if(this.hasSwitch){
            let modifyButton = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                margin_start: 10,
                active: this.switchActive
            });
            grid.insert_column(0);
            grid.attach(Gtk.Separator.new(Gtk.Orientation.VERTICAL), 0, 0, 1, 1);
            grid.insert_column(0);
            grid.attach(modifyButton, 0, 0, 1, 1);
        }
        if(this.hasEditButton){
            let editButton = new Button({
                icon_name: 'text-editor-symbolic',
            });
            grid.insert_column(0);
            grid.attach(Gtk.Separator.new(Gtk.Orientation.VERTICAL), 0, 0, 1, 1);
            grid.insert_column(0);
            grid.attach(editButton, 0, 0, 1, 1);
        }
        dragRow.add_suffix(grid);
        
        return dragWidget;
    }
});

var EditEntriesBox = GObject.registerClass({
    Signals: {
        'modify': {},
        'change': {},
        'row-changed': {},
        'row-deleted': {}
    },
},  class Arc_Menu_EditEntriesBox extends Gtk.Grid{
    _init(params){
        super._init({
            margin_top: 0,
            margin_bottom: 0,
            vexpand: false,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            column_spacing: 10
        });
        let editPopover = new Gtk.Popover();
        let frameRow = params.frameRow;

        let modifyButton, deleteButton, changeButton;

        if(params.modifyButton){
            modifyButton = new Gtk.Button({
                label: _("Modify"),
                has_frame: false
            });
            modifyButton.connect('clicked', () => {
                editPopover.popdown();
                this.emit('modify');
            });
        }

        if(params.changeButton){
            changeButton = new Button({
                icon_name: 'text-editor-symbolic',
            });
            changeButton.connect('clicked', () => {
                editPopover.popdown();
                this.emit('change');
            });
        }

        let editButton = new Gtk.MenuButton({
            icon_name: 'view-more-symbolic',
            popover: editPopover,
        });

        this.attach(editButton, 0, 0, 1, 1);

        let editPopoverBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        editPopover.set_child(editPopoverBox);

        let moveUpButton = new Gtk.Button({
            label: _("Move Up"),
            has_frame: false
        });
        moveUpButton.connect('clicked', ()=> {
            let parent = frameRow.get_parent();
            let index = frameRow.get_index();
            if(index > 0){
                parent.remove(frameRow);
                parent.insert(frameRow, index - 1);
            }
            parent.show();
            editPopover.popdown();
            this.emit('row-changed');
        });

        let moveDownButton = new Gtk.Button({
            label: _("Move Down"),
            has_frame: false
        });
        moveDownButton.connect('clicked', ()=> {
            let parent = frameRow.get_parent();
            let children = [...parent];
            let index = frameRow.get_index();
            if(index + 1 < children.length) {
                parent.remove(frameRow);
                parent.insert(frameRow, index + 1);
            }
            parent.show();
            editPopover.popdown();
            this.emit('row-changed');
        });

        if(params.deleteButton){
            deleteButton = new Gtk.Button({
                label: _("Delete"),
                has_frame: false,
            });
            deleteButton.connect('clicked', ()=> {
                let parent = frameRow.get_parent();
                parent.remove(frameRow);
                parent.show();
                editPopover.popdown();
                this.emit('row-deleted');
            });
        }

        if(params.changeButton){
            this.insert_column(0);
            this.attach(Gtk.Separator.new(Gtk.Orientation.VERTICAL), 0, 0, 1, 1);
            this.insert_column(0);
            this.attach(changeButton, 0, 0, 1, 1);
        }

        if(params.modifyButton){
            editPopoverBox.append(modifyButton);
            editPopoverBox.append(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL));
        }

        editPopoverBox.append(moveUpButton);
        editPopoverBox.append(moveDownButton);

        if(params.deleteButton){
            editPopoverBox.append(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL));
            editPopoverBox.append(deleteButton);
        }
    }
});

var StackListBox = GObject.registerClass(class Arc_Menu_StackListBox extends Gtk.ListBox{
    _init(widget, params){
        super._init(params);
        this.settingsFrameStack = widget.settingsFrameStack;
        this.connect("row-selected", (self, row) => {
            if(row){
                let stackName = row.stackName;
                widget.headerLabel.label = "<b>" + _(row.translateableName) + "</b>",
                this.settingsFrameStack.set_visible_child_name(stackName);
            }
        });
    }

    getRowAtIndex(index){
        return this.get_row_at_index(index).get_children()[0];
    }

    getSelectedRow(){
        return this.get_selected_row().get_children()[0];
    }

    selectFirstRow(){
        this.select_row(this.get_row_at_index(0));
    }

    selectRowAtIndex(index){
        this.select_row(this.get_row_at_index(index));
    }

    selectRowByName(name){
        let children = [...this];
        for(let child of children){
            if(child.stackName === name)
                this.select_row(child);
        }
    }

    addRow(name, translateableName, iconName, nextPage){
        let row1 = new Gtk.ListBoxRow();
        this.append(row1);

        let row = new Gtk.Grid({
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12, 
            column_spacing: 10
        });
        row1.set_child(row);
        row1.stackName = name;
        row1.translateableName = translateableName;
        
        let image = new Gtk.Image({ 
            icon_name: iconName
        });

        let label = new Gtk.Label({
            label: translateableName,
            halign: Gtk.Align.START,
        });
        row.attach(image, 0, 0, 1, 1);
        row.attach(label, 1, 0, 1, 1);

        if(nextPage){
            row1.nextPage = nextPage;
            let image2 = new Gtk.Image({ 
                gicon: Gio.icon_new_for_string('go-next-symbolic'),
                halign: Gtk.Align.END,
                hexpand: true
            });
            row.attach(image2, 2, 0, 1, 1);
        }
    }

    setSeparatorIndices(indexArray){
        this.set_header_func((_row, _before) =>{
            for(let i = 0; i < indexArray.length; i++){
                if(_row.get_index() === indexArray[i]){
                    let sep = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL);
                    sep.show();
                    _row.set_header(sep);
                    
                }
            }
        });
    }
});

var IconGrid = GObject.registerClass(class Arc_Menu_IconGrid extends Gtk.FlowBox{
    _init() {
        super._init({
            max_children_per_line: 7,
            row_spacing: 10,
            column_spacing: 10,
            vexpand: true,
            hexpand: false,
            valign: Gtk.Align.START,
            halign: Gtk.Align.CENTER,
            homogeneous: true,
            selection_mode: Gtk.SelectionMode.SINGLE
        });
        this.childrenCount = 0;
    }

    add(widget){
        this.insert(widget, -1);
        this.childrenCount++;
    }
});

var Tile = GObject.registerClass(class Arc_Menu_Tile extends Adw.PreferencesGroup{
    _init(name, file, width, height, layout) {
        super._init({
            hexpand: true,
            vexpand: false,
            halign: Gtk.Align.FILL,
            valign: Gtk.Align.CENTER,
        });
        this.name = name;
        this.layout = layout;

        this.box = new Adw.ActionRow({
            activatable: true
        });
        this._grid = new Gtk.Grid({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 5,
            margin_bottom: 5,
            margin_start: 5,
            margin_end: 5,
            column_spacing: 20,
            row_spacing: 0
        });
        this.box.set_child(this._grid);

        this._image = new Gtk.Image({
            gicon: Gio.icon_new_for_string(file),
            pixel_size: width
        });

        this._label = new Gtk.Label({ 
            label: _(this.name) 
        });

        this._grid.attach(this._image, 0, 0, 1, 1);
        this._grid.attach(this._label, 0, 1, 1, 1);
        this.add(this.box);
    }
});

var MenuLayoutRow = GObject.registerClass(class Arc_Menu_MenuLayoutRow extends Adw.ActionRow {
    _init(title, imagePath, imageSize, layout) {
        super._init();
        this._grid = new Gtk.Grid({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_top: 5,
            margin_bottom: 5,
            margin_start: 5,
            margin_end: 5,
            column_spacing: 0,
            row_spacing: 0
        });

        if(layout){
            this.layout = layout.MENU_TYPE;
        }

        this.title = "<b>" + _(title) + "</b>"
        this.image = new Gtk.Image({ 
            hexpand: false,
            halign: Gtk.Align.START,
            gicon: Gio.icon_new_for_string(imagePath),
            pixel_size: imageSize
        });
        
        this.label = new Gtk.Label({
            label: "<b>" + _(title) + "</b>",
            use_markup: true,
            hexpand: true,
            halign: Gtk.Align.CENTER,
            vexpand: true,
            valign: Gtk.Align.CENTER,
            wrap: true,
        })

        let goNextImage = new Gtk.Image({
            gicon: Gio.icon_new_for_string('go-next-symbolic'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
        })
        this._grid.attach(this.image, 0, 0, 1, 1);
        this._grid.attach(this.label, 0, 0, 1, 1);
        this._grid.attach(goNextImage, 0, 0, 1, 1);

        this.set_child(this._grid);
        this.activatable_widget = this._grid;

    }
});
