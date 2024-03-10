import {FACTIONS, SYSTEM_ID} from "../constants.js";

export class WarhammerWeaponSheet extends ItemSheet {
    /** @inheritdoc */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["warhammer", "sheet", "item"],
            width: 520,
            height: 480,
            dragDrop: [{ dragSelector: '.item-name', dropSelector: '.sheet-body' }],
        });
    }

    /* -------------------------------------------- */
    /** @override */
    get template() {
        const path = `systems/${SYSTEM_ID}/templates/item`;
        // unique item sheet by type, like `weapon-sheet.html` -->.
        return `${path}/${this.item.type}-sheet.html`;
    }

    /** @inheritdoc */
    async getData(options) {
        const context = super.getData(options)
        context.system = context.data.system;
        context.SYSTEM_ID = SYSTEM_ID;
        context._id = this.item._id
        this._prepareItems(context)
        return context;
    }

    _prepareItems(context) {
        // Initialize containers.
        let tags = []
        // Iterate through items, allocating to containers
        for (let tagid of this.item.system.tags) {
            tags.push(this.actor.items.get(tagid))
        }
        // Assign and return
        context.items = tags;
    }

    /* -------------------------------------------- */
    /** @inheritdoc */
    activateListeners(html) {
        html[0].style.setProperty(`--faction-color`, FACTIONS[this.actor.system.faction]);
        // Render the item sheet for viewing/editing prior to the editable check.
        html.find('.item-edit').click(ev => {
            const item = this.actor.items.get(ev.currentTarget.dataset.itemid);
            item.sheet.render(true);
        });

        // -------------------------------------------------------------
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));

        // Delete Inventory Item
        html.find('.item-delete').click(this._onItemDelete.bind(this));

        super.activateListeners(html);

    }
    async _onItemDelete(event) {
        const item = this.actor.items.get(event.currentTarget.dataset.itemid);
        let newtaglist = this.item.system.tags
        const index = newtaglist.indexOf(event.currentTarget.dataset.itemid);
        if (index > -1) { // only splice array when item is found
            newtaglist.splice(index, 1); // 2nd parameter means remove one item only
        }
        let update = {_id: this.item._id,
            "system.tags": newtaglist,
        }
        await Item.updateDocuments([update], {parent: this.actor});
        item.delete();
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const system = duplicate(header.dataset);
        // Initialize a default name.
        const name = `New Tag`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            system: system
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.system["type"];
        // Finally, create the item!
        let item = await Item.create(itemData, {parent: this.actor});
        this.item.system.tags.push(item._id)
        let update = {_id: this.item._id,
            "system.tags": this.item.system.tags
        }
        await Item.updateDocuments([update], {parent: this.actor});
    }


}

