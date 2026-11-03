import { transaction, type AdminDatabase } from './database.ts';
import { AdminError, type AdminAccount } from './types.ts';
export function accessStore(db: AdminDatabase) {
  return {
    async list(): Promise<AdminAccount[]> {
      const result=await db.query(`SELECT u.id,u.email,u.created_at,COALESCE(p.display_name,u.email) AS display_name
        FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.role='admin' AND u.is_active=true ORDER BY u.created_at,u.id`);
      return result.rows.map(r=>({id:r.id,email:r.email,displayName:r.display_name,createdAt:new Date(r.created_at).toISOString()}));
    },
    async change(actorId: string, emailOrId: string, grant: boolean) {
      return transaction(db,async client=>{
        // Rare administrative writes are serialized, including validation of the actor's current role.
        await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
        const actor=await client.query("SELECT id FROM users WHERE id=$1 AND role='admin' AND is_active=true",[actorId]);
        if(!actor.rows.length)throw new AdminError('Tu cuenta ya no tiene permisos de administrador.',403);
        const found=await client.query(`SELECT id,is_active FROM users WHERE ${grant?'lower(email)=$1':'id::text=$1'}`,[emailOrId]);
        if(found.rows.length!==1)throw new AdminError('La cuenta debe estar registrada en PyLevel antes de habilitarla.',404);
        const user=found.rows[0];
        if(!user.is_active)throw new AdminError('La cuenta está inactiva.',409);
        if(!grant && String(user.id)===String(actorId))throw new AdminError('No puedes retirar tu propio acceso de administrador.',409);
        await client.query('UPDATE users SET role=$2,updated_at=now() WHERE id=$1',[user.id,grant?'admin':'user']);
        return {id:user.id};
      });
    },
  };
}
