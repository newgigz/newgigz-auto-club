// NEWGIGZ Auto Club: browser compression and private draft photo management.
const MIME = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const LIMIT = 1048576, ORIGINAL_LIMIT = 10 * LIMIT, TARGET = 500 * 1024;
function validate(file) {
  if (!file) return 'Select a photograph first.';
  if (!Object.hasOwn(MIME,file.type)) return `${file.name}: choose JPEG, PNG or WebP.`;
  if (!file.size) return `${file.name}: the file is empty.`;
  if (file.size > ORIGINAL_LIMIT) return `${file.name}: exceeds the 10 MiB original file limit.`;
  return '';
}
async function prepare(file, type='image/jpeg') {
  const issue=validate(file); if(issue) throw new Error(issue);
  const url=URL.createObjectURL(file); const img=new Image();
  try {
    img.src=url; await img.decode();
    if(!img.naturalWidth || !img.naturalHeight || img.naturalWidth*img.naturalHeight>60000000) throw Error('Unsupported image dimensions');
    const canvas=document.createElement('canvas');
    let scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    for(let attempt=0;attempt<9;attempt++,scale*=0.8){
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=canvas.getContext('2d'); if(!ctx)throw Error('Canvas unavailable');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      for(const quality of (type==='image/png'?[1]:[0.86,0.76,0.65,0.54])){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
        if(blob && blob.type===type && blob.size>0 && blob.size<=TARGET){canvas.width=canvas.height=1;return blob;}
      }
    }
    throw Error('Compression failed');
  } catch {throw new Error(`${file.name}: unable to prepare this image. Try another photograph.`);} finally {URL.revokeObjectURL(url);}
}
export function createPhotoManager(supabase){
  let generation=0;
  const panel=document.createElement('section');panel.hidden=true;panel.className='photo-manager';
  panel.innerHTML='<h3 id="photo-heading" tabindex="-1">Vehicle photographs</h3><p>Up to 10 JPEG, PNG or WebP images. Originals up to 10 MiB are automatically resized and compressed. The first registered image is primary.</p><p role="status" aria-live="polite" class="photo-status"></p><div class="photo-content"></div>';
  document.getElementById('inventory').append(panel);panel.setAttribute('aria-labelledby','photo-heading');
  const status=panel.querySelector('.photo-status'),content=panel.querySelector('.photo-content'),bucket=supabase.storage.from('vehicle-photos');
  const close=()=>{generation++;panel.hidden=true;content.replaceChildren();status.textContent='';};
  function button(label,fn){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.addEventListener('click',fn);return b;}
  function message(parent){const p=document.createElement('p');p.className='photo-feedback';p.setAttribute('role','status');p.setAttribute('aria-live','polite');parent.append(p);return p;}
  function picker(parent,labelText,multiple=false){const label=document.createElement('label');label.textContent=labelText;const input=document.createElement('input');input.type='file';input.accept=Object.keys(MIME).join(',');input.multiple=multiple;label.append(input);parent.append(label);return input;}
  async function upload(blob,path){const {error}=await bucket.upload(path,blob,{upsert:false,contentType:blob.type});if(error)throw error;}
  async function open(vehicle,focus=true,notice=''){
    const token=++generation,active=()=>token===generation;panel.hidden=false;content.replaceChildren();status.textContent='Loading photographs…';
    panel.querySelector('h3').textContent=`Photographs: ${vehicle.year} ${vehicle.make} ${vehicle.model}`;if(focus)panel.querySelector('h3').focus();
    try{
      const {data:rows,error}=await supabase.from('vehicle_photos').select('id,vehicle_id,storage_path,display_order,is_primary,status').eq('vehicle_id',vehicle.id).order('display_order');if(!active())return;if(error)throw error;
      const {data:objects,error:listError}=await bucket.list(vehicle.id,{limit:100});if(!active())return;if(listError)throw listError;
      const present=new Set(objects.map(o=>o.name));let busy=false;
      const lock=value=>{busy=value;content.querySelectorAll('button,input').forEach(e=>e.disabled=value);};
      const finish=async msg=>{if(active())await open(vehicle,false,msg);};
      const remaining=10-rows.length;
      status.textContent=`${rows.length} of 10 photograph positions registered. ${remaining} remaining.`;
      const controls=document.createElement('div');controls.className='photo-controls';content.append(controls);
      if(remaining>0){
        const input=picker(controls,'Select photographs',true);
        const feedback=message(controls);feedback.textContent=notice||`${remaining} photograph position(s) available.`;
        function selectionIssue(files){if(!files.length)return 'Select at least one photograph.';if(files.length>remaining)return `Only ${remaining} photograph position(s) remain. Select fewer files.`;return files.map(validate).find(Boolean)||'';}
        input.addEventListener('change',()=>{const files=Array.from(input.files);feedback.textContent=selectionIssue(files)||`${files.length} selected. Ready for compression and upload.`;});
        controls.append(button('Upload selected photographs',async()=>{
          if(busy||!active())return;const files=Array.from(input.files),issue=selectionIssue(files);if(issue){feedback.textContent=issue;return;}
          lock(true);const prepared=[];
          try{for(let i=0;i<files.length;i++){if(!active())return;feedback.textContent=`Preparing photograph ${i+1} of ${files.length}…`;prepared.push(await prepare(files[i]));}}catch(e){if(active()){feedback.textContent=e.message;lock(false);}return;}
          if(!active())return;let completed=0;const used=new Set(rows.map(r=>r.display_order));let primary=rows.some(r=>r.is_primary);
          try{const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw Error('Sign in required');
            for(const blob of prepared){if(!active())return;const position=Array.from({length:10},(_,i)=>i+1).find(i=>!used.has(i));const path=`${vehicle.id}/${crypto.randomUUID()}.jpg`;feedback.textContent=`Uploading ${completed+1} of ${prepared.length} (${Math.ceil(blob.size/1024)} KiB)…`;
              const {error}=await supabase.from('vehicle_photos').insert({vehicle_id:vehicle.id,storage_path:path,display_order:position,is_primary:!primary,uploaded_by:user.id});if(error)throw error;if(!active())return;
              await upload(blob,path);used.add(position);primary=true;completed++;
            }await finish(`${completed} photograph(s) uploaded. Pending review.`);
          }catch{await finish(`${completed} upload(s) confirmed. Check the gallery and retry any empty registered slot.`);}
        }));
      }else{message(controls).textContent=notice||'Maximum capacity reached. All 10 positions are registered.';}
      const grid=document.createElement('div');grid.className='photo-grid';content.append(grid);
      for(const row of rows){
        const card=document.createElement('article');card.className='photo-card';grid.append(card);const name=row.storage_path.split('/').pop();
        const label=document.createElement('p');label.textContent=`Photo ${row.display_order}${row.is_primary?' — Primary':''} | ${row.status}`;card.append(label);
        if(present.has(name)){
          const {data,error}=await bucket.createSignedUrl(row.storage_path,60);if(!active())return;
          if(!error){const img=document.createElement('img');img.src=data.signedUrl;img.alt=`Vehicle photograph ${row.display_order}`;card.prepend(img);}else label.textContent+=' | Preview unavailable';
        }else if(row.status==='pending'){
          const input=picker(card,`Retry photo ${row.display_order}`);const feedback=message(card);
          const type=name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg';
          card.append(button('Retry upload',async()=>{if(busy||!active())return;const issue=validate(input.files[0]);if(issue){feedback.textContent=issue;return;}lock(true);let blob;try{feedback.textContent='Preparing photograph…';blob=await prepare(input.files[0],type);}catch(e){if(active()){feedback.textContent=e.message;lock(false);}return;}if(!active())return;try{feedback.textContent='Uploading photograph…';await upload(blob,row.storage_path);await finish('Upload completed. Pending review.');}catch{await finish('Upload not confirmed. Refresh and retry if the slot is still empty.');}}));
        }else label.textContent+=' | File unavailable';
      }
      if(!active())return;content.append(button('Refresh photographs',()=>open(vehicle,false)),button('Close photograph manager',close));
    }catch{if(active()){status.textContent='Unable to load photographs. Check your session and try again.';content.replaceChildren(button('Retry loading',()=>open(vehicle,false)),button('Close',close));}}
  }
  return {open,close};
}
