import {WarhammerToken} from "../token.js";

export class WarhammerObjectiveData extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            //in mm
            baseSize: new fields.NumberField({
                nullable: false,
                required: true,
                initial: 40,
                integer: true
            }),
            // in inches
            captureRange: new fields.NumberField({
                nullable: false,
                required: true,
                initial: 3,
                integer: true
            }),
            tokens: new fields.SetField(new fields.StringField()),
            captured: new fields.BooleanField({
                required: true,
                nullable: false,
                initial: false,
            }),
        };
    }
}