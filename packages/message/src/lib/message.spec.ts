import { message, requiredField } from './message'

describe('message', () => {
    it('should work', () => {
        expect(message()).toEqual('message')
    })
})

describe('Message Library', () => {
    it('requiredField', () => {
        expect(requiredField('name')).toEqual(`name is a required field.`)
        expect(requiredField('Email')).toEqual(`Email is a required field.`)
    })
})
