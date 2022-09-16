import type { Request, Response, NextFunction } from 'express'
import type { User } from './user'

interface AuthRequest extends Request {
    user: User
}

export { AuthRequest as Request, Response, NextFunction }
