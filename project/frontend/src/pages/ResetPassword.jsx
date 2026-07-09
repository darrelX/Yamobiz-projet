import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'


export default function ResetPassword(){

const [password,setPassword]=useState('')
const navigate=useNavigate()


async function submit(e){

e.preventDefault()

const {error}=await supabase.auth.updateUser({
 password
})

if(error){
 alert(error.message)
}
else{
 alert("Mot de passe modifié")
 navigate('/login')
}

}


return (

<div className="max-w-md mx-auto mt-20">

<h1 className="text-2xl font-bold mb-5">
Nouveau mot de passe
</h1>


<form onSubmit={submit}>

<input
type="password"
placeholder="Nouveau mot de passe"
value={password}
onChange={e=>setPassword(e.target.value)}
className="w-full border p-3 rounded-xl"
/>


<button className="mt-4 w-full bg-brand-600 text-white p-3 rounded-xl">
Changer le mot de passe
</button>

</form>

</div>

)

}