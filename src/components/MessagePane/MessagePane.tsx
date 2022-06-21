import styles from './styles.module.scss';
import RouterEndpoints from '../../common/RouterEndpoints';

import { createEffect, createSignal, For, on, onCleanup, onMount} from 'solid-js';
import { useLocation, useParams } from 'solid-app-router';
import useStore from '../../chat-api/store/useStore';
import MessageItem from '../MessageItem';
import CustomButton from '../CustomButton';
import { useWindowProperties } from '../../common/useWindowProperties';
import { RawMessage } from '../../chat-api/RawData';
import socketClient from '../../chat-api/socketClient';
import { ServerEvents } from '../../chat-api/EventNames';

export default function MessagePane() {
  const params = useParams();
  const {channels, tabs} = useStore();

  createEffect(() => {
    const channel = channels.get(params.channelId!);
    if (!channel) return;
  
    const path = params.serverId ? RouterEndpoints.SERVER_MESSAGES(params.serverId!, params.channelId!) : RouterEndpoints.INBOX_MESSAGES(params.channelId!);
  
    const userId = channel.recipient?._id;
    
    tabs.openTab({
      title: channel.name,
      serverId: params.serverId!,
      userId: userId,
      iconName: params.serverId ? 'dns' : 'inbox',
      path: path,
    });

  })


  return (
    <div class={styles.messagePane}>
       <MessageLogArea />
      <MessageArea />
    </div>
  );
}





const MessageLogArea = () => {
  let messageLogElement: undefined | HTMLDivElement;
  const params = useParams();
  const {channels, messages} = useStore();
  const channelMessages = () => messages.getMessagesByChannelId(params.channelId!);
  const [openedTimestamp, setOpenedTimestamp] = createSignal<null | number>(null);
  const channel = () => channels.get(params.channelId!);
  const {hasFocus} = useWindowProperties();

  createEffect(on(channel ,() => {
    setOpenedTimestamp(null);
    if (!channel()) return;
    messages.fetchAndStoreMessages(channel()._id).then(() => {
      setOpenedTimestamp(Date.now());
      channel()?.dismissNotification();
    })
  }))
  
  createEffect(on([() => channelMessages()?.length], () => {
    if (messageLogElement) {
      messageLogElement.scrollTop = 99999;
    }
  }))
  
  createEffect(on(hasFocus, () => {
    if (hasFocus()) {
      channel()?.dismissNotification();
    }
  }))
  
  const onMessage = (message: RawMessage) => {
    const selectedChannelId = params.channelId;
    const newMessageChannelId = message.channel;
    if (selectedChannelId !== newMessageChannelId) return;
    channel()?.dismissNotification();
  }

  onMount(() => {
    socketClient.socket.on(ServerEvents.MESSAGE_CREATED, onMessage);
    onCleanup(() => {
      socketClient.socket.off(ServerEvents.MESSAGE_CREATED, onMessage);
    })
  })
  

  

  return <div class={styles.messageLogArea} ref={messageLogElement} >
    <For each={channelMessages()}>
      {(message, i) => (
        <MessageItem
          animate={!!openedTimestamp() && message.createdAt > openedTimestamp()!}
          message={message}
          beforeMessage={channelMessages()?.[i() - 1]}
        />
      )}
    </For>
  </div>
}



function MessageArea() {
  const params = useParams();
  const location = useLocation();

  const [message, setMessage] = createSignal('');
  const {tabs, channels, messages} = useStore();

  const onKeyDown = (event: any) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const trimmedMessage = message().trim();
      setMessage('')
      if (!trimmedMessage) return;
      const channel = channels.get(params.channelId!);
      tabs.updateTab(location.pathname!, {isPreview: false})
      messages.sendAndStoreMessage(channel._id, trimmedMessage);
    }
  }
  
  const onInput = (event: any) => {
    setMessage(event.target?.value);
  }


  return <div class={styles.messageArea}>
    <textarea placeholder='Message' class={styles.textArea} onkeydown={onKeyDown} onInput={onInput} value={message()}></textarea>
    <CustomButton iconName='send' class={styles.button}/>
  </div>
}