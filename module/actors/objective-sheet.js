import {SYSTEM_ID} from "../constants.js";

export class WarhammerObjectiveSheet extends ActorSheet {
    /** @inheritdoc */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["warhammer", "sheet", "actor"],
            template: `systems/${SYSTEM_ID}/templates/objective-sheet.hbs`,
            width: 600,
            height: 650,
        });
    }
}