const VAPID_STORAGE_KEY = "bolao-connect:vapid-public-key";

function keyToBytes(value:string){
  const padding="=".repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

function keysMatch(current:ArrayBuffer|null,target:Uint8Array){
  if(!current)return false;
  const bytes=new Uint8Array(current);
  return bytes.length===target.length&&bytes.every((value,index)=>value===target[index]);
}

export async function ensureCurrentPushSubscription(registration:ServiceWorkerRegistration,publicKey:string){
  const targetKey=keyToBytes(publicKey);
  let subscription=await registration.pushManager.getSubscription();
  let storedKey:string|null=null;
  try{storedKey=window.localStorage.getItem(VAPID_STORAGE_KEY)}catch{}

  if(subscription&&!keysMatch(subscription.options.applicationServerKey,targetKey)&&storedKey!==publicKey){
    await subscription.unsubscribe();
    subscription=null;
  }

  if(!subscription){
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:targetKey});
  }

  try{window.localStorage.setItem(VAPID_STORAGE_KEY,publicKey)}catch{}
  return subscription;
}
