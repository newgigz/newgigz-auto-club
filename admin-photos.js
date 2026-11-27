// NEWGIGZ Auto Club: private administrator photograph review.
// Integrate using the existing authenticated Supabase client.
export function createAdminPhotoManager(client, { onReviewed = async () => {} } = {}) {
  let generation = 0;
  const panels = new Set();
  const element = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const clear = () => { generation++; for (const p of panels) p.replaceChildren(); panels.clear(); };
  async function authorize() {
    const {data, error} = await client.auth.getUser();
    if (error || !data?.user) throw new Error('Administrator sign-in required.');
    const role = await client.rpc('is_auto_club_admin');
    if (role.error || role.data !== true) throw new Error('Administrator access required.');
  }
  async function mount(parent, vehicle, dealer, onReadiness = () => {}) {
    const epoch = generation;
    const panel = element('section', undefined, 'admin-photos');
    panels.add(panel); parent.append(panel);
    const active = () => epoch === generation && panel.isConnected;
    panel.append(element('h4', 'Photograph review'));
    const message = element('p', 'Loading photographs…'); message.setAttribute('role','status'); panel.append(message);
    onReadiness(false);
    try {
      await authorize();
      const {data, error} = await client.from('vehicle_photos').select('id,vehicle_id,storage_path,display_order,is_primary,status,reviewed_by,reviewed_at,review_notes').eq('vehicle_id',vehicle.id).order('display_order');
      if (error) throw error;
      if (!active()) return;
      const photos = data || [];
      message.textContent = `${photos.length} photograph(s). An approved primary photograph is required to publish.`;
      const grid = element('div', undefined, 'admin-photo-grid'); panel.append(grid);
      let busy = false;
      const controls = [];
      const sync = () => controls.forEach(fn => fn());
      for (const photo of photos) {
        const card = element('article', undefined, 'admin-photo-card'); grid.append(card);
        card.append(element('h5', `Photo ${photo.display_order}${photo.is_primary ? ' · Primary' : ''}`), element('p', `Status: ${photo.status}`));
        const img = element('img'); img.alt = `Vehicle photograph ${photo.display_order}`; img.hidden = true; card.append(img);
        const status = element('p','Private preview not loaded.'); status.setAttribute('role','status'); card.append(status);
        const preview = element('button','Load / refresh private preview'); preview.type='button'; card.append(preview);
        preview.onclick = async () => {
          preview.disabled = true; img.hidden = true; img.removeAttribute('src');
          try {
            await authorize();
            const {data,error} = await client.storage.from('vehicle-photos').createSignedUrl(photo.storage_path,60);
            if(error || !data?.signedUrl) throw error || new Error('Preview unavailable.');
            if(!active()) return;
            img.onload = () => { if(active()) { img.hidden=false; status.textContent='Private preview loaded. Link expires after 60 seconds.'; } };
            img.onerror = () => { if(active()) { img.hidden=true; status.textContent='Image could not be loaded. Refresh the preview.'; } };
            img.src=data.signedUrl;
          } catch(e) { if(active()) status.textContent=e.message || 'Preview failed.'; }
          finally { if(active()) preview.disabled=false; }
        };
        if(photo.review_notes) card.append(element('p', `Latest review: ${photo.review_notes}`));
        if(photo.reviewed_at) card.append(element('p', `Reviewed: ${new Date(photo.reviewed_at).toLocaleString()}`));
        const history = element('details'); history.append(element('summary','Review history')); const entries=element('div'); history.append(entries); card.append(history);
        history.addEventListener('toggle', async () => {
          if(!history.open) return; entries.textContent='Loading history…';
          try { await authorize(); const {data,error}=await client.from('vehicle_photo_reviews').select('previous_status,new_status,review_notes,reviewed_by,reviewed_at').eq('vehicle_photo_id',photo.id).order('reviewed_at',{ascending:false}).limit(100); if(error) throw error; if(!active()) return; entries.replaceChildren(); for(const r of data||[]) entries.append(element('p',`${new Date(r.reviewed_at).toLocaleString()} · ${r.previous_status} → ${r.new_status} · ${r.review_notes} · Reviewer: ${r.reviewed_by}`)); if(!data?.length) entries.textContent='No review history.'; } catch(e) { if(active()) entries.textContent=e.message || 'History unavailable.'; }
        });
        const label=element('label','Photograph review notes (required)'); const notes=element('textarea'); notes.id=`photo-notes-${photo.id}`; notes.maxLength=2000; label.htmlFor=notes.id; card.append(label,notes);
        const eligible=dealer?.status==='approved' && ['draft','pending_review','published'].includes(vehicle.status);
        for(const decision of ['approved','rejected']) {
          const button=element('button',decision==='approved'?'Approve photograph':'Reject photograph'); button.type='button'; card.append(button);
          const update=()=>{button.disabled=busy || !notes.value.trim() || photo.status===decision || (decision==='approved'&&!eligible);}; controls.push(update); notes.addEventListener('input',update); update();
          button.onclick=async()=>{
            if(button.disabled || !active()) return;
            const reason=notes.value.trim();
            if(!confirm(`Mark photograph ${photo.display_order} ${decision}?${decision==='rejected'&&photo.is_primary&&vehicle.status==='published'?' This may withdraw the vehicle from publication.':''}`)) return;
            busy=true; sync();
            try { await authorize(); if(!active()) return; const {error}=await client.rpc('review_vehicle_photo',{p_photo_id:photo.id,p_status:decision,p_review_notes:reason}); if(error) throw error; if(!active()) return; status.textContent='Review recorded. Refreshing vehicle status…'; onReadiness(false); await onReviewed(); }
            catch(e) { if(active()) status.textContent=e.message || 'Review or refresh failed. Refresh before retrying.'; }
            finally { busy=false; if(active()) sync(); }
          };
        }
      }
      // Advisory only: the database independently validates storage and publication.
      if(active()) onReadiness(photos.some(p=>p.is_primary && p.status==='approved'));
    } catch(e) { if(active()) message.textContent=e.message || 'Unable to load photographs.'; }
  }
  return { mount, clear };
}
