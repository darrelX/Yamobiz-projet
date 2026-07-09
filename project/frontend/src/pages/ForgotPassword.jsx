import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ForgotPassword(){

const { resetPassword } = useAuth()

const [email,setEmail] = useState('')
const [message,setMessage] = useState('')
const [error,setError] = useState('')


async function submit(e){
 e.preventDefault()

 try{
   await resetPassword(email)
   setMessage("Un lien de réinitialisation a été envoyé.")
 }
 catch(err){
   setError(err.message)
 }
}


return (
<div className="max-w-md mx-auto mt-20">

<h1 className="text-2xl font-bold mb-6">
Mot de passe oublié
</h1>

<form onSubmit={submit} className="space-y-4">

<input
type="email"
required
placeholder="Votre email"
value={email}
onChange={e=>setEmail(e.target.value)}
className="w-full border p-3 rounded-xl"
/>

<button className="w-full bg-brand-600 text-white p-3 rounded-xl">
Envoyer le lien
</button>

</form>

{message && <p className="text-green-600 mt-4">{message}</p>}
{error && <p className="text-red-600 mt-4">{error}</p>}

</div>
)

}