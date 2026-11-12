(()=>{
'use strict';
const widget=document.getElementById('jananee-walker'),button=document.getElementById('jananee-walker-button'),canvas=document.getElementById('jananee-walker-canvas'),bubble=document.getElementById('jananee-walker-bubble'),dismiss=document.getElementById('jananee-walker-dismiss'),restore=document.getElementById('jananee-walker-restore');
const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const gestureOrder=[0,0,1,2,3,4,5,5,4,3,2,1,0,6,7,8,8,7,6,0,0],poseDuration=260;
let walk=[],gestures=[],x=18,direction=1,previousTime=0,walkElapsed=0,gestureElapsed=0,idleElapsed=0,hover=false,hidden=false,greeting=false;
async function loadSheet(url,columns,rows){
 const image=new Image();image.src=url;await image.decode();
 const cellW=image.naturalWidth/columns,cellH=image.naturalHeight/rows,off=document.createElement('canvas');off.width=Math.ceil(cellW);off.height=Math.ceil(cellH);
 const c=off.getContext('2d',{willReadFrequently:true}),frames=[];
 for(let index=0;index<columns*rows;index++){
  c.clearRect(0,0,off.width,off.height);c.drawImage(image,index%columns*cellW,Math.floor(index/columns)*cellH,cellW,cellH,0,0,off.width,off.height);
  const pixels=c.getImageData(0,0,off.width,off.height).data;
  let top=off.height,bottom=-1,left=off.width,right=-1;
  for(let y=0;y<off.height;y++){let count=0;for(let xx=0;xx<off.width;xx++)if(pixels[(y*off.width+xx)*4+3]>220)count++;if(count>off.width*.025){top=Math.min(top,y);bottom=Math.max(bottom,y)}}
  if(bottom<top)throw Error('Empty character frame');
  for(let xx=0;xx<off.width;xx++){let count=0;for(let y=top;y<=bottom;y++)if(pixels[(y*off.width+xx)*4+3]>220)count++;if(count>off.height*.015){left=Math.min(left,xx);right=Math.max(right,xx)}}
  frames.push({image,x:index%columns*cellW+Math.max(0,left-2),y:Math.floor(index/columns)*cellH+Math.max(0,top-2),w:Math.min(cellW-left,right-left+5),h:Math.min(cellH-top,bottom-top+5)});
 }
 return frames;
}
function draw(frame,gesture=false){
 const f=(gesture?gestures:walk)[frame];if(!f)return;
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const scale=Math.min((canvas.height-12)/f.h,(canvas.width-12)/f.w),w=f.w*scale,h=f.h*scale;
 ctx.save();if(!gesture&&direction<0){ctx.translate(canvas.width,0);ctx.scale(-1,1)}
 ctx.drawImage(f.image,f.x,f.y,f.w,f.h,(canvas.width-w)/2,canvas.height-h-6,w,h);ctx.restore();
 canvas.dataset.frame=String(frame);canvas.dataset.motion=gesture?'cake-greeting':'cake-walk';
}
function updatePosition(){
 const limit=Math.max(12,innerWidth-widget.offsetWidth-12);x=Math.min(Math.max(12,x),limit);widget.style.transform='translate3d('+x+'px,0,0)';widget.dataset.direction=direction>0?'right':'left';bubble.style.left=x<100?'0':'auto';bubble.style.right=x<100?'auto':'0';
}
function sayHello(showBubble=true){
 if(!gestures.length)return;greeting=true;gestureElapsed=0;idleElapsed=0;
 bubble.hidden=!showBubble;bubble.textContent="Hi! I'm Jananee. Let's talk cake! 💗";
 if(reduced.matches){draw(0,true);greeting=false;setTimeout(()=>bubble.hidden=true,3500)}
}
button.addEventListener('click',()=>sayHello());button.addEventListener('pointerenter',()=>hover=true);button.addEventListener('pointerleave',()=>hover=false);button.addEventListener('focus',()=>hover=true);button.addEventListener('blur',()=>hover=false);
dismiss.addEventListener('click',()=>{hidden=true;widget.hidden=true;bubble.hidden=true;restore.hidden=false;restore.focus()});
restore.addEventListener('click',()=>{hidden=false;widget.hidden=false;restore.hidden=true;previousTime=0;button.focus();sayHello(false)});
addEventListener('resize',updatePosition);document.addEventListener('visibilitychange',()=>previousTime=0);
function animate(now){
 const dt=previousTime?Math.min((now-previousTime)/1000,.05):0;previousTime=now;
 if(!hidden&&!document.hidden&&!document.querySelector('dialog[open]')){
  if(reduced.matches){draw(0,true)}
  else if(greeting){
   gestureElapsed+=dt*1000;const step=Math.floor(gestureElapsed/poseDuration);
   if(step>=gestureOrder.length){greeting=false;bubble.hidden=true;idleElapsed=0;draw(0)}else draw(gestureOrder[step],true);
  }else if(!hover){
   idleElapsed+=dt;if(idleElapsed>=14){sayHello(false)}else{
    const limit=Math.max(12,innerWidth-widget.offsetWidth-12);x+=direction*28*dt;
    if(x>=limit){x=limit;direction=-1}else if(x<=12){x=12;direction=1}
    walkElapsed+=dt;draw(Math.floor(walkElapsed/.15)%walk.length);updatePosition();
   }
  }else draw(0,true);
 }
 requestAnimationFrame(animate);
}
Promise.all([loadSheet('/jananee-cake-walk.png',3,2),loadSheet('/jananee-cake-gestures.png',3,3)]).then(([w,g])=>{
 walk=w;gestures=g;widget.hidden=false;widget.dataset.ready='true';draw(0,true);updatePosition();sayHello(false);requestAnimationFrame(animate);
}).catch(error=>{widget.hidden=true;restore.hidden=true;console.error('Cake mascot could not load',error)});
})();
