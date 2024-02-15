import {SYSTEM_ID} from "../constants.js";

export class WarhammerWTagSheet extends ItemSheet {
    /** @inheritdoc */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["warhammer", "sheet", "item"],
            width: 520,
            height: 480,
        });
    }

    /* -------------------------------------------- */
    /** @override */
    get template() {
        const path = `systems/${SYSTEM_ID}/templates/item`;
        // unique item sheet by type, like `weapon-sheet.html` -->.
        return `${path}/${this.item.type}-sheet.html`;
    }
}