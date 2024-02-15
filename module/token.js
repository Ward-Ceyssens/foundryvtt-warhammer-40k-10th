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

        return r
    }
}