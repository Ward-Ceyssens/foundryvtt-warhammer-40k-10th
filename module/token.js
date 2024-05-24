import {FACTIONS, SYSTEM_ID} from "./constants.js";

/** * Extend the base TokenDocument
 * @extends {TokenDocument}
 */
export class WarhammerTokenDocument extends TokenDocument {
    /** @inheritdoc */

    // none of these are useful so just block all of them
    // TODO at some point turn this on properly
    static getTrackedAttributes(data, _path = []) {
        // if (_path == "uv")
            return {bar:[], value:[]}
        // return super.getTrackedAttributes(data);
    }
}
export class WarhammerTokenConfig extends TokenConfig {


    async _renderInner(...args) {
        let injectedHTML = `
            <div class="form-group slim">
            <label>Art Offset</label>
            <div class="form-fields">
                <label>X</label>
                <input type="number" step="1" name="flags.${SYSTEM_ID}.offX" placeholder="px" ${this.object.getFlag(SYSTEM_ID, "offX") ? "value=\""+this.object.getFlag(SYSTEM_ID, "offX")+"\"" : ""}>
                <label>Y</label>
                <input type="number" step="1" name="flags.${SYSTEM_ID}.offY" placeholder="px" ${this.object.getFlag(SYSTEM_ID, "offY") ? "value=\""+this.object.getFlag(SYSTEM_ID, "offY")+"\"" : ""}>
            </div>
        </div>
`
        let r = await super._renderInner(...args);
        r.find("[name=width]").closest(".form-group").after(injectedHTML)
        return r;
    }
}
export class WarhammerToken extends Token {
    async _refreshBorder(){
        this.hitArea = new PIXI.Circle(this.w/2,this.w/2, this.w/2)
        if (this.actor?.type === "objective") //TODO split objective border and capture piechart into 2 so borders can be drawn here
            return
        if (this.controlled || this.hover){
            this.border.clear()
            this.border.lineStyle(4, 0x000000, 0.8).drawCircle(this.w/2,this.w/2, this.w/2);
            this.border.lineStyle(2, this._getBorderColor() || 0xFF9829, 1.0).drawCircle(this.w/2,this.w/2, this.w/2);
        }
        else this.border.clear()
    }
    //this causes twitches when closing the token config, but it's the best i've found
    async applyRenderFlags(){
        //token offset
        const pivotx = this.document.getFlag(SYSTEM_ID, "offX");
        const pivoty = this.document.getFlag(SYSTEM_ID, "offY");
        this.mesh.pivot.x = pivotx ?? 0;
        this.mesh.pivot.y = pivoty ?? 0;
        await super.applyRenderFlags();
    }

    async _refreshVisibility(){
        if (canvas.initialized && this.actor?.type === "objective"){
            let cap = this.actor.generateCapturePercentages()
            let total = cap.reduce((acc, val) => acc+val[1], 0)
            cap.map(val => val[1] /= total)
            cap = cap.sort((a,b) => a[0] > b[0] ? -1 : 1)

            let x = this.w / 2
            let y = this.w / 2
            let radius = this.w / 2

            //return early
            if (cap.length !== 0) {
                this.border.clear()
                this.border.beginFill("0x" + FACTIONS[cap[0][0]].slice(1)).arc(x, y, radius, 0.5 * Math.PI - Math.PI * 2 * cap[0][1], 0.5 * Math.PI)
                    .arc(x, y, 0, 0.5 * Math.PI - Math.PI * 2 * cap[0][1], 0.5 * Math.PI).endFill();
                if (cap[1]) {
                    this.border.beginFill("0x" + FACTIONS[cap[1][0]].slice(1)).arc(x, y, radius, 0.5 * Math.PI, 0.5 * Math.PI + Math.PI * 2 * cap[1][1])
                        .arc(x, y, 0, 0.5 * Math.PI, 0.5 * Math.PI + Math.PI * 2 * cap[1][1]).endFill();
                }
            }
            if (this.controlled || this.hover){
                this.border.lineStyle(4, 0x000000, 0.8).drawCircle(x,y,radius);
                this.border.lineStyle(2, this._getBorderColor() || 0xFF9829, 1.0).drawCircle(x,y,radius);
                this.border.lineStyle(4, 0x000000, 0.8).drawCircle(x,y,radius+300);
                this.border.lineStyle(2, this._getBorderColor() || 0xFF9829, 1.0).drawCircle(x,y,radius+300);
            }
        }
    }
}