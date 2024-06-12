import {FACTIONS, mmToInch, SYSTEM_ID} from "./constants.js";

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

    getSize() {
        if (!this.actor?.system?.baseSize)
            return super.getSize();

        let size = mmToInch(this.actor?.system?.baseSize)*100;
        return {
            width: size,
            height: size
        }
    }

    getShape() {
        return new PIXI.Circle(this.w/2,this.w/2, this.w/2);
    }

    //this causes twitches when closing the token config, but it's the best i've found
    async applyRenderFlags(){
        if (!this.mesh)
            return;
        //token offset
        const pivotx = this.document.getFlag(SYSTEM_ID, "offX");
        const pivoty = this.document.getFlag(SYSTEM_ID, "offY");
        this.mesh.pivot.x = pivotx ?? 0;
        this.mesh.pivot.y = pivoty ?? 0;
        await super.applyRenderFlags();
    }

    async _refreshCapture(){
        if (!canvas.initialized || this.actor?.type !== "objective"){
            return;
        }

        let cap = this.actor.generateCapturePercentages()
        let total = cap.reduce((acc, val) => acc+val[1], 0)
        cap.map(val => val[1] /= total)
        cap = cap.sort((a,b) => a[0] > b[0] ? -1 : 1)

        let x = this.getShape().x
        let y = this.getShape().y
        let radius = this.getShape().radius

        if (!this.objCaptureTexture) {
            this.objCaptureTexture = new PIXI.Graphics()
            this.addChildAt(this.objCaptureTexture, 0)
        } else
            this.objCaptureTexture.clear()

        if (cap.length !== 0) {
            this.objCaptureTexture.beginFill("0x" + FACTIONS[cap[0][0]].color.slice(1)).arc(x, y, radius, 0.5 * Math.PI - Math.PI * 2 * cap[0][1], 0.5 * Math.PI)
                .arc(x, y, 0, 0.5 * Math.PI - Math.PI * 2 * cap[0][1], 0.5 * Math.PI).endFill();
            if (cap[1]) {
                this.objCaptureTexture.beginFill("0x" + FACTIONS[cap[1][0]].color.slice(1)).arc(x, y, radius, 0.5 * Math.PI, 0.5 * Math.PI + Math.PI * 2 * cap[1][1])
                    .arc(x, y, 0, 0.5 * Math.PI, 0.5 * Math.PI + Math.PI * 2 * cap[1][1]).endFill();
            }
        }
    }
    async _refreshBorder(){
        if (!canvas.initialized || this.actor?.type !== "objective"){
            return super._refreshBorder()
        }

        let x = this.getShape().x
        let y = this.getShape().y
        let radius = this.getShape().radius


        this.border.lineStyle(4, 0x000000, 0.8).drawCircle(x,y,radius);
        this.border.lineStyle(2, this._getBorderColor() || 0xFF9829, 1.0).drawCircle(x,y,radius);
        this.border.lineStyle(4, 0x000000, 0.8).drawCircle(x,y,radius+300);
        this.border.lineStyle(2, this._getBorderColor() || 0xFF9829, 1.0).drawCircle(x,y,radius+300);

    }
}