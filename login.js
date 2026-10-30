const form=document.getElementById('invite-form');
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=document.getElementById('invite-submit'), error=document.getElementById('invite-error');
  button.disabled=true; error.textContent='Checking invite…';
  try{
    const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:document.getElementById('invite-code').value})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Could not verify invite.');
    window.location.assign('/');
  }catch(err){error.textContent=err.message||'Could not verify invite.';button.disabled=false;}
});
