import {getBaseToBaseDist} from "./constants.js";

export class WarhammerRuler extends Ruler {
    targetToken
    starttoken
    _onMouseMove(event){
        if (event.target.actor)
            this.targetToken = event.target
        else this.targetToken = null
        super._onMouseMove(event)
    }
    _onDragStart(event){
        if (event.target.actor)
            this.starttoken = event.target
        else this.starttoken = null
        super._onDragStart(event)
    }
    _getSegmentLabel(segment){
        if (this.starttoken && this.targetToken && tokenRuler.active && segment.last)
            this.totalDistance = getBaseToBaseDist(this.starttoken, this.targetToken)
        return super._getSegmentLabel(segment)
    }
}