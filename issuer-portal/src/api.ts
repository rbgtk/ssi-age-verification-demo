export async function api<T>(path:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);if(init.body)headers.set('content-type','application/json')
  const response=await fetch(`/issuer-api${path}`,{...init,headers});const text=await response.text();let body:unknown=text
  try{body=text?JSON.parse(text):undefined}catch{/* preserve plain text */}
  if(!response.ok){const value=typeof body==='object'&&body?body as Record<string,unknown>:{};throw new Error(String(value.message??value.error??value.detail??text??`${response.status} ${response.statusText}`))}
  return body as T
}
