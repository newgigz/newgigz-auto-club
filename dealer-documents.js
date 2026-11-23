import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const client=createClient('https://nxlovetjigddieykrzny.supabase.co','sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ');
const TYPES=[['formation','Certificate of Incorporation / LLC formation document'],['dealer_license','Current Georgia dealer license']];
const root=document.createElement('section');root.className='panel';root.id='dealer-document-panel';root.hidden=true;
root.innerHTML='<h2>Required verification documents</h2><p>Upload both PDF documents (10 MB maximum each). Applications cannot be approved until NEWGIGZ independently verifies both documents. Documents are private.</p><p id="doc-status" role="status" aria-live="polite"></p><div id="doc-fields"></div>';
const anchor=document.getElementById('authenticated');if(anchor)anchor.append(root);
const message=s=>{document.getElementById('doc-status').textContent=s;};
let activeDealer=null,activeUser=null,request=0;
function addField(type,label,existing){
 const wrap=document.createElement('div');wrap.style.marginBottom='1rem';const title=document.createElement('label');title.textContent=label;title.htmlFor='doc-'+type;
 const state=document.createElement('p');state.textContent=existing?(existing.verified_at?'Verified by NEWGIGZ':'Uploaded, awaiting review'):'Not uploaded';
 const input=document.createElement('input');input.id='doc-'+type;input.type='file';input.accept='application/pdf,.pdf';input.disabled=!!existing||activeDealer.status!=='pending';
 const button=document.createElement('button');button.type='button';button.textContent='Upload PDF';button.disabled=!!existing||activeDealer.status!=='pending';button.className='secondary';
 button.onclick=async()=>{
  const file=input.files?.[0];if(!file)return message('Choose a PDF first.');
  if(file.type!=='application/pdf'||!file.name.toLowerCase().endsWith('.pdf'))return message('Only PDF files are allowed.');
  if(file.size>10485760||file.size===0)return message('The PDF must be between 1 byte and 10 MB.');
  const {data:{user}}=await client.auth.getUser();if(!user||user.id!==activeUser)return message('Please sign in again.');
  const dealer=activeDealer;const path=`${user.id}/${dealer.id}/${type}.pdf`;
  button.disabled=true;input.disabled=true;message('Uploading document securely...');
  const {error:uploadError}=await client.storage.from('dealer-verification').upload(path,file,{contentType:'application/pdf',upsert:false});
  if(uploadError){button.disabled=false;input.disabled=false;return message('Upload failed: '+uploadError.message);}
  const {error:recordError}=await client.from('dealership_documents').insert({dealership_id:dealer.id,document_type:type,storage_path:path,original_filename:file.name,uploaded_by:user.id});
  if(recordError){message('File uploaded but document registration failed. Contact NEWGIGZ support; do not upload again.');return;}
  message('Document uploaded. Awaiting administrator verification.');await refresh();
 };
 wrap.append(title,state,input,button);return wrap;
}
async function refresh(){
 const stamp=++request;const {data:{user}}=await client.auth.getUser();if(stamp!==request)return;
 if(!user){root.hidden=true;activeUser=null;activeDealer=null;return;}
 const {data:dealer,error}=await client.from('dealerships').select('id,status').eq('owner_user_id',user.id).maybeSingle();
 if(stamp!==request)return;
 if(error||!dealer){root.hidden=true;return;}
 activeDealer=dealer;activeUser=user.id;root.hidden=false;
 const {data:docs,error:docsError}=await client.from('dealership_documents').select('document_type,verified_at').eq('dealership_id',dealer.id);
 if(stamp!==request)return;
 if(docsError){message('Could not load document status.');return;}
 const fields=document.getElementById('doc-fields');fields.replaceChildren();for(const [type,label] of TYPES)fields.append(addField(type,label,(docs||[]).find(d=>d.document_type===type)));
 if(dealer.status!=='pending')message('Document uploads are available while your dealership application is pending.');
}
client.auth.onAuthStateChange(()=>{setTimeout(()=>refresh().catch(()=>message('Unable to load verification documents.')),0);});
refresh().catch(()=>message('Unable to load verification documents.'));
