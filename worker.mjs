import {handle} from './lib/server.mjs';
export default {fetch(request,env){return handle(request,env.DB,{ownerEmail:env.ADMIN_OWNER_EMAIL,bucket:env.BUCKET,loginUsername:env.ADMIN_LOGIN_USERNAME,bootstrapEmail:env.ADMIN_BOOTSTRAP_EMAIL,bootstrapSalt:env.ADMIN_BOOTSTRAP_SALT,bootstrapHash:env.ADMIN_BOOTSTRAP_HASH})}};
