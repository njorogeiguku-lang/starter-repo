const form=document.getElementById('auth-form');
const message=document.getElementById('auth-message');
const workspaceField=document.getElementById('workspace-field');
const passwordField=document.getElementById('password-field');
const passwordInput=document.getElementById('password');
const submitButton=document.getElementById('submit-auth');
const toggleButton=document.getElementById('toggle-mode');
const forgotButton=document.getElementById('forgot-password');
let mode='login';

function setMessage(text,error=false){message.textContent=text;message.classList.toggle('error',error);}
function setMode(next){
  mode=next;
  const signup=mode==='register', recovery=mode==='recover', reset=mode==='reset';
  document.getElementById('auth-heading').textContent=signup?'Create your workspace':recovery?'Reset your password':reset?'Choose a new password':'Welcome back.';
  document.getElementById('auth-intro').textContent=signup?'Start a private workspace for your agency.':recovery?'We’ll email you a secure password reset link.':reset?'Choose a new password to secure your account.':'Sign in to your secure workspace.';
  workspaceField.hidden=!signup;
  document.getElementById('email-field').hidden=reset;
  passwordField.hidden=recovery;
  document.getElementById('email').required=!reset;
  document.getElementById('workspace-name').required=signup;
  passwordInput.required=!recovery;
  passwordInput.autocomplete=reset?'new-password':signup?'new-password':'current-password';
  passwordInput.placeholder=reset||signup?'At least 12 characters':'Your password';
  submitButton.textContent=signup?'Create account':recovery?'Send reset link':reset?'Save new password':'Sign in';
  forgotButton.hidden=signup||recovery||reset;
  toggleButton.hidden=reset;
  toggleButton.textContent=signup?'I already have an account':recovery?'Back to sign in':'Create an account';
  document.querySelector('.auth-divider').hidden=recovery||reset;
  setMessage('');
}
async function post(path,payload={}){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'same-origin'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'That request could not be completed.');
  return result;
}
toggleButton.onclick=()=>setMode(mode==='register'||mode==='recover'?'login':'register');
forgotButton.onclick=()=>setMode('recover');
form.onsubmit=async event=>{
  event.preventDefault();setMessage('');submitButton.disabled=true;
  const values=Object.fromEntries(new FormData(form));
  try{
    if(mode==='register'){
      const result=await post('/api/auth/register',values);
      if(result.authenticated)location.replace('/');
      else setMessage('Check your email for a verification link, then return here to sign in.');
    }else if(mode==='login'){
      await post('/api/auth/login',values);location.replace('/');
    }else if(mode==='recover'){
      await post('/api/auth/recover',{email:values.email});setMessage('If that account exists, a password reset email is on its way.');
    }else if(mode==='reset'){
      await post('/api/auth/password',{password:values.password});setMode('login');setMessage('Password updated. Sign in with your new password.');
    }
  }catch(error){setMessage(error.message||'Could not complete your request.',true);}
  finally{submitButton.disabled=false;}
};

async function handleAuthLink(){
  const params=new URLSearchParams(location.search), tokenHash=params.get('token_hash'), type=params.get('type');
  if(tokenHash&&type){
    try{
      const result=await post('/api/auth/verify',{tokenHash,type});
      history.replaceState({},'',location.pathname);
      if(result.recovery||location.pathname==='/auth/reset')setMode('reset');else location.replace('/');
    }catch(error){history.replaceState({},'',location.pathname);setMode(location.pathname==='/auth/reset'?'recover':'login');setMessage(error.message||'This email link has expired. Request a new one.',true);}
    return;
  }
  if(params.get('error'))setMessage('This email link has expired or was already used. Request a fresh link.',true);
  const response=await fetch('/api/session',{credentials:'same-origin'}).catch(()=>null);
  const session=response?.ok?await response.json().catch(()=>null):null;
  if(session?.authenticated)location.replace('/');
  if(params.get('mode')==='reset')setMode('reset');
}
setMode(new URLSearchParams(location.search).get('mode')==='reset'?'login':'login');
handleAuthLink();
