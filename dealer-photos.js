// NEWGIGZ Auto Club: draft photograph manager, storage limit 1 MiB.
const MIME = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const LIMIT = 1048576;
export function createPhotoManager(supabase) {
  let generation = 0;
  const panel = document.createElement('section');
  panel.hidden = true;
  panel.className = 'photo-manager';
  panel.innerHTML = '<h3 id="photo-heading" tabindex="-1">Vehicle photographs</h3><p>Up to 10 images, JPEG, PNG or WebP, maximum 1 MiB each. The first registered image is primary.</p><p role="status" aria-live="polite" class="photo-status"></p><div class="photo-content"></div>';
  document.getElementById('inventory').append(panel);
  panel.setAttribute('aria-labelledby','photo-heading');
  const status = panel.querySelector('.photo-status'), content = panel.querySelector('.photo-content');
  const bucket = supabase.storage.from('vehicle-photos');
  const close = () => { generation++; panel.hidden = true; content.replaceChildren(); status.textContent=''; };
  function button(label, fn) { const b=document.createElement('button'); b.type='button'; b.className='secondary'; b.textContent=label; b.addEventListener('click',fn); return b; }
  async function open(vehicle, focus=true) {
    const token=++generation; const active=()=>token===generation;
    panel.hidden=false; content.replaceChildren(); status.textContent='Loading photographs…';
    panel.querySelector('h3').textContent=`Photographs: ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    if(focus) panel.querySelector('h3').focus();
    try {
      const {data:rows,error}=await supabase.from('vehicle_photos').select('id,vehicle_id,storage_path,display_order,is_primary,status').eq('vehicle_id',vehicle.id).order('display_order');
      if(!active())return; if(error)throw error;
      const {data:objects,error:listError}=await bucket.list(vehicle.id,{limit:100});
      if(!active())return; if(listError)throw listError;
      const present=new Set(objects.map(o=>o.name));
      const grid=document.createElement('div');grid.className='photo-grid';content.append(grid);
      let busy=false;
      const lock=()=>{busy=true;content.querySelectorAll('button,input').forEach(e=>e.disabled=true);};
      const finish=async(message)=>{if(active()){await open(vehicle,false);if(!panel.hidden)status.textContent=message;}};
      async function upload(file,path){const {error}=await bucket.upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;}
      const valid=f=>f && MIME[f.type] && f.size>0 && f.size<=LIMIT;
      for(const row of rows){
        const card=document.createElement('article');card.className='photo-card';grid.append(card);
        const name=row.storage_path.split('/').pop();
        const label=document.createElement('p');label.textContent=`Photo ${row.display_order}${row.is_primary?' — Primary':''} | ${row.status}`;card.append(label);
        if(present.has(name)){
          const {data,error}=await bucket.createSignedUrl(row.storage_path,60);
          if(!active())return;
          if(!error){const img=document.createElement('img');img.src=data.signedUrl;img.alt=`Vehicle photograph ${row.display_order}`;card.prepend(img);}else label.textContent+=' | Preview unavailable';
        }else if(row.status==='pending'){
          const input=document.createElement('input');input.type='file';input.accept=Object.keys(MIME).join(',');input.setAttribute('aria-label',`Retry photo ${row.display_order}`);card.append(input);
          card.append(button('Retry upload',async()=>{if(busy||!active())return;const f=input.files[0];if(!valid(f)||!(name.endsWith('.'+MIME[f.type])||(f.type==='image/jpeg'&&name.endsWith('.jpeg')))){status.textContent='Select a matching image format, no larger than 1 MiB.';return;}lock();try{await upload(f,row.storage_path);await finish('Upload completed.');}catch{await finish('Upload not confirmed. Refresh and retry if the slot is still empty.');}}));
        }else label.textContent+=' | File unavailable';
      }
      if(!active())return;
      status.textContent=`${rows.length} of 10 photograph positions registered.`;
      if(rows.length<10){
        const label=document.createElement('label');label.textContent='Select photographs';label.htmlFor='new-vehicle-photos';content.append(label);
        const input=document.createElement('input');input.id=label.htmlFor;input.type='file';input.multiple=true;input.accept=Object.keys(MIME).join(',');content.append(input);
        content.append(button('Upload selected photographs',async()=>{
          if(busy||!active())return;const files=Array.from(input.files);if(!files.length||files.length>10-rows.length||files.some(f=>!valid(f))){status.textContent='Choose valid images within the available slots and 1 MiB per image.';return;}
          lock();let completed=0;const used=new Set(rows.map(r=>r.display_order));let primary=rows.some(r=>r.is_primary);
          try{const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw Error('Sign in required');
            for(const file of files){if(!active())return;const position=Array.from({length:10},(_,i)=>i+1).find(i=>!used.has(i));const path=`${vehicle.id}/${crypto.randomUUID()}.${MIME[file.type]}`;status.textContent=`Uploading ${completed+1} of ${files.length}…`;
              const {error}=await supabase.from('vehicle_photos').insert({vehicle_id:vehicle.id,storage_path:path,display_order:position,is_primary:!primary,uploaded_by:user.id});if(error)throw error;
              if(!active())return;await upload(file,path);used.add(position);primary=true;completed++;
            }await finish(`${completed} photograph(s) uploaded. Pending review.`);
          }catch{await finish(`${completed} upload(s) confirmed. Check the gallery and retry any empty registered slot.`);}
        }));
      }
      content.append(button('Refresh photographs',()=>open(vehicle,false)),button('Close photograph manager',close));
    }catch{if(active()){status.textContent='Unable to load photographs. Check your session and try again.';content.replaceChildren(button('Retry loading',()=>open(vehicle,false)),button('Close',close));}}
  }
  return {open,close};
}
