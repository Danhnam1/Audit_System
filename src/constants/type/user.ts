import type { Expand } from '../../utils/globalUtil'

export interface User {
    fullName: string
    email: string | null
    deptId?: number | null
    role?: string  // Backend returns "role"
    roleName?: string  // Keep for backward compatibility
}



//Auth Request
export type LoginPayload = {
  email: string
  password: string
}

export type ChangePassPayload = {
    email?: string
    password: string
    new_password: string
    new_password_confirm: string
}

export type RegisterPayload = Expand<
    Pick<User, 'fullName' | 'email' | 'deptId' | 'roleName'> & {
        password: string
        
    }
>

export type ResetPassPayload = {
    phone: string
    password_type?: Array<'login' | 'wallet'>
    captcha: string
}





//Auth Response Success
export type LoginResponse = User & {
  token: string
}

export type RegisterResponse = Pick<User, 'fullName' | 'email' | 'deptId' | 'roleName'>

export type ProfileResponse = User & {
  referer?: string
  group_code?: string
}

export type RefreshResponse = User & {
  token: string
}
