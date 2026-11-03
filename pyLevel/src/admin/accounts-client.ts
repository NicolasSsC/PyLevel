import { adminRequest } from './client-api';
import type { AdminAccount } from './types';
const get=<T extends HTMLElement>(id: string)=>document.getElementById(id) as T;
const seed=JSON.parse(get('admin-access-data').textContent || '{}') as {admins:AdminAccount[];actorId:string};
const feedback=get('add-admin-feedback');
const modal=get<HTMLDialogElement>('revoke-admin-modal');
let pendingId: string | null=null;
function render(admins: AdminAccount[]) {
  get('admins-table-rows').replaceChildren(...admins.map(admin=>{
    const row=document.createElement('tr');
    for(const [i,value] of [admin.displayName,admin.email,new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeZone:'America/Bogota'}).format(new Date(admin.createdAt)),'Habilitado'].entries()) {
      const cell=document.createElement('td');const content=document.createElement(i===0?'strong':i===1?'code':'span');content.textContent=value;
      if(i===3)content.className='account-status green';cell.append(content);row.append(cell);
    }
    const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='account-button secondary';button.dataset.revoke=admin.id;button.disabled=admin.id===seed.actorId;button.textContent=button.disabled?'Tu cuenta':'Retirar acceso';cell.append(button);row.append(cell);
    return row;
  }));
  get('admin-count-pill').textContent=`${admins.length} ${admins.length===1?'administrador':'administradores'}`;
}
get<HTMLFormElement>('add-admin-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=get<HTMLButtonElement>('btn-submit-admin');button.disabled=true;feedback.textContent='Comprobando la cuenta…';
  try {
    const data=await adminRequest('/api/admin/admins','POST',{email:get<HTMLInputElement>('admin-email').value.trim()});
    render(data.admins);feedback.textContent='Cuenta habilitada como administrador. Su contraseña se conserva.';get<HTMLFormElement>('add-admin-form').reset();
  }catch(error){feedback.textContent=(error as Error).message;}
  finally{button.disabled=false;}
});
get('admins-table-rows').addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button[data-revoke]');
  if(!button || button.disabled)return;pendingId=button.dataset.revoke!;modal.showModal();
});
get('revoke-admin-cancel').addEventListener('click',()=>modal.close());
get('revoke-admin-confirm').addEventListener('click',async()=>{
  const button=get<HTMLButtonElement>('revoke-admin-confirm');button.disabled=true;
  try {const data=await adminRequest(`/api/admin/admins/${pendingId}`,'DELETE');render(data.admins);feedback.textContent='Acceso administrativo retirado. La cuenta sigue siendo de estudiante.';}
  catch(error){feedback.textContent=(error as Error).message;}
  finally{button.disabled=false;modal.close();}
});
