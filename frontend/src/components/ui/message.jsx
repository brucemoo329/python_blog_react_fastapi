import { cn } from '@/lib/utils'

function Message({ align = 'start', className, ...props }) {
  return <div data-slot="message" data-align={align} className={cn('message-row', className)} {...props} />
}

function MessageGroup({ className, ...props }) {
  return <div data-slot="message-group" className={cn('message-group', className)} {...props} />
}

function MessageAvatar({ className, ...props }) {
  return <div data-slot="message-avatar" className={cn('message-avatar-slot', className)} {...props} />
}

function MessageContent({ className, ...props }) {
  return <div data-slot="message-content" className={cn('message-content', className)} {...props} />
}

function MessageHeader({ className, ...props }) {
  return <div data-slot="message-header" className={cn('message-header', className)} {...props} />
}

function MessageFooter({ className, ...props }) {
  return <div data-slot="message-footer" className={cn('message-footer', className)} {...props} />
}

export { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader }
