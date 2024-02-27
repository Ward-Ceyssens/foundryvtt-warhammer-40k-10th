import {FACTIONS} from "./constants.js";

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

export class WarhammerToken extends Token {
    refresh(){
        const r = super.refresh()
        this.hitArea = new PIXI.Circle(this.w/2,this.w/2, this.w/2)
        if (this.controlled || this.hover){
            this.border.clear()
            this.border.lineStyle(4, 0x000000, 0.8).drawCircle(this.w/2,this.w/2, this.w/2);
            this.border.lineStyle(2, this._getBorderColor() || 0xFF9829, 1.0).drawCircle(this.w/2,this.w/2, this.w/2);
        }
        if (this.actor.type === "objective" && canvas.initialized){
            let cap = this.actor.generateCapturePercentages()
            let total = cap.reduce((acc, val) => acc+val[1], 0)
            cap.map(val => val[1] /= total)
            cap = cap.sort((a,b) => a[0] > b[0] ? -1 : 1)

            //return early
            if (cap.length === 0)
                return r
            let x = this.w/2
            let y = this.w/2
            let radius = this.w/2

            this.border.clear()
            this.border.beginFill("0x"+FACTIONS[cap[0][0]].slice(1)).arc(x,y,radius, 0.5*Math.PI - Math.PI*2*cap[0][1], 0.5*Math.PI)
                .arc(x,y,0, 0.5*Math.PI - Math.PI*2*cap[0][1], 0.5*Math.PI).endFill();
            if (cap[1])
                this.border.beginFill("0x"+FACTIONS[cap[1][0]].slice(1)).arc(x,y,radius,  0.5*Math.PI, 0.5*Math.PI+Math.PI*2*cap[1][1])
                    .arc(x,y,0,  0.5*Math.PI, 0.5*Math.PI+Math.PI*2*cap[1][1]).endFill();
        }
        return r
    }
}