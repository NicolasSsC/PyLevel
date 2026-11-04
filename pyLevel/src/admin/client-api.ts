export async function adminRequest(path: string, method='GET', body?: unknown, signal?: AbortSignal) {
  const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store',signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error || 'No se pudo completar la operación. Intenta nuevamente.');
  return data;
}
