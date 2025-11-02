import { Util, apply, toLocal } from './graphics.js'

// Hit test: pick top-most visible object whose local bbox contains point p
export function pickTopObjectAt(pv, p, state){
  const ids=[...state.order].reverse().filter(id=>state.objects[id].page===pv.index && !state.objects[id].hidden)
  for(const id of ids){
    const obj=state.objects[id]
    const bb=pv.bboxOf(obj)
    const local=toLocal(p, obj.transform)
    if(Util.ptInRect(local, {x:bb.x,y:bb.y,w:bb.w,h:bb.h})) return obj
  }
  return null
}

// Return ids of objects on pv that intersect the given world-space rect (box)
export function objectsIntersectingRect(pv, box, state){
  const ids = state.order.filter(id=>state.objects[id].page===pv.index)
  const picked=[]
  for(const id of ids){
    const obj=state.objects[id]
    const bb=pv.bboxOf(obj)
    const tl=apply(obj.transform,{x:bb.x,y:bb.y})
    const br=apply(obj.transform,{x:bb.x+bb.w,y:bb.y+bb.h})
    const r={x:Math.min(tl.x,br.x),y:Math.min(tl.y,br.y),w:Math.abs(tl.x-br.x),h:Math.abs(tl.y-br.y)}
    if(Util.rectInter(box,r)) picked.push(id)
  }
  return picked
}
