import {SYSTEM_ID} from "../constants.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class WarhammerAbilitySheet extends ItemSheet {
    /** @inheritdoc */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["warhammer", "sheet", "item"],
            width: 520,
            height: 480,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
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
        context.descriptionHTML = await TextEditor.enrichHTML(context.system.description, {
            secrets: this.document.isOwner,
            async: true
        });
        return context;
    }

    /* -------------------------------------------- */
    /** @inheritdoc */
    activateListeners(html) {
        super.activateListeners(html);
        // Everything below here is only needed if the sheet is editable
        // if (!this.isEditable)

        // Attribute Management

    }
}