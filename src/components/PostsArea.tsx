import { PostNotificationType, RawPost, RawPostNotification } from "@/chat-api/RawData";
import { createPost, getCommentPosts, getPost, getPostNotifications, getPosts, likePost, unlikePost } from "@/chat-api/services/PostService";
import { Post } from "@/chat-api/store/usePosts";
import useStore from "@/chat-api/store/useStore";
import { formatTimestamp } from "@/common/date";
import RouterEndpoints from "@/common/RouterEndpoints";
import { Link } from "@nerimity/solid-router";
import { createEffect, createMemo, createSignal, For, JSX, on, onMount, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { css, styled } from "solid-styled-components";
import { Markup } from "./Markup";
import Avatar from "./ui/Avatar";
import Button from "./ui/Button";
import { useCustomPortal } from "./ui/custom-portal/CustomPortal";
import { FlexColumn, FlexRow } from "./ui/Flexbox";
import Icon from "./ui/icon/Icon";
import Input from "./ui/input/Input";
import Modal from "./ui/Modal";
import Text from "./ui/Text";

const NewPostContainer = styled(FlexColumn)`
  overflow: auto;
  padding-top: 5px;
  padding-bottom: 5px;
  background: rgba(255, 255, 255, 0.06);
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 10px;
  border-radius: 8px;
  margin-bottom: 15px;
`;

const createButtonStyles = css`
  align-self: end;
`;


function NewPostArea (props: {postId?: string}) {
  const {posts} = useStore();
  const [content, setContent] = createSignal("");

  const onCreateClick = async () => {
    if (props.postId) {
      posts.cachedPost(props.postId)?.submitReply(content())
    } else {
      posts.submitPost(content());
    }
    setContent("");
  }

  return (
    <NewPostContainer>
      <Input label={props.postId ? 'Write your reply...' : "Write your post..."} onText={setContent} value={content()} type="textarea" height={60} />
      <Button margin={0} class={createButtonStyles} onClick={onCreateClick} label={props.postId ? 'Reply' : "Create"} iconName="send"  />
    </NewPostContainer>
  )
}

const PostContainer = styled(FlexColumn)`
  scroll-margin-top: 50px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding-top: 5px;
  padding-bottom: 5px;
  padding-left: 6px;
  padding-right: 6px;
  cursor: pointer;
  &:hover {
    background: rgba(255, 255, 255, 0.07);
  }
`;

const PostDetailsContainer = styled(FlexRow)`
  align-items: center;
  margin-top: 5px;
  margin-left: 5px;
`;

const PostActionsContainer = styled(FlexRow)`
  align-items: center;
  margin-top: 5px;
  margin-left: 41px;
`;

const postActionStyle = css`
  background: transparent;
  padding: 5px;
  .label {
    font-size: 14px;
  }
  .icon {
    font-size: 14px;
  }
`;

export function PostItem(props: { onClick?: (id: Post) => void; post: Post}) {
  const {posts} = useStore();
  const [requestSent, setRequestSent] = createSignal(false);
  const {createPortal} = useCustomPortal();
  const Details = () => (
    <PostDetailsContainer gap={10}>
      <Avatar hexColor={props.post.createdBy.hexColor} size={35} />
      <Text>{props.post.createdBy.username}</Text>
      <Text style={{"margin-left": "-2px"}} size={12} color="rgba(255,255,255,0.5)">{formatTimestamp(props.post.createdAt)}</Text>
    </PostDetailsContainer>
  )

  const isLikedByMe = () => props.post.likedBy.length;
  const likedIcon = () => isLikedByMe() ? 'favorite' : 'favorite_border'

  const replyingTo = createMemo(() => {
    if (!props.post.commentToId) return;
    return posts.cachedPost(props.post.commentToId)
  })


  const onLikeClick = async () => {
    if (requestSent()) return;
    setRequestSent(true);
    if (isLikedByMe()) {
      await props.post.unlike();
      setRequestSent(false);
      return;
    }
    await props.post.like();
    setRequestSent(false);
  } 

  const Actions = () => (
    <PostActionsContainer>
      <Button margin={2} onClick={onLikeClick} class={postActionStyle} iconName={likedIcon()} label={props.post._count.likedBy.toLocaleString()} />
      <Button margin={2} class={postActionStyle} iconName="comment" label={props.post._count.comments.toLocaleString()} />
      <Button margin={2} class={postActionStyle} iconName="format_quote" label="0" />
      <Button margin={2} class={postActionStyle} iconName="share" />
    </PostActionsContainer>
  );

  const onClick = (event: any) => {
    if (event.target.closest(".button")) return;
    createPortal?.((close) => <ViewPostModal close={close} postId={props.post.id} />)
  }

  return (
    <PostContainer tabIndex="0" onClick={onClick}>
      <Show when={replyingTo()}>
        <FlexRow gap={5} style={{"margin-left": "5px", "margin-top": "5px"}}>
          <Text size={14}>Replying to</Text>
          <Text size={14} color="var(--primary-color)">{replyingTo()?.createdBy.username}</Text>
        </FlexRow>
      </Show>
      <Details/>
      <Text size={14} color="rgba(255,255,255,0.8)" style={{"margin-left": "50px"}}>
        <Markup text={props.post.content} />
      </Text>
      <Actions/>
    </PostContainer>
  )  
}


const PostsContainer = styled(FlexColumn)`
  overflow: auto;

`;

export function PostsArea(props: { showLiked?: boolean, showFeed?: boolean, showReplies?: boolean, postId?: string, userId?: string, showCreateNew?: boolean, style?: JSX.CSSProperties}) {

  const {posts} = useStore();

  const cachedPosts = () => {
    if (props.showFeed) return posts.cachedFeed();
    if (props.userId) return posts.cachedUserPosts(props.userId!);
    return posts.cachedPost(props.postId!)?.cachedComments();
  };

  createEffect(() => {
    if (props.userId) {
      if (props.showLiked) {
        return posts.fetchUserLikedPosts(props.userId)
      }
      posts.fetchUserPosts(props.userId!, props.showReplies)
    }
  })

  onMount(() => {
    if (props.showFeed) {
      posts.fetchFeed();
      return;
    }
    if (props.postId) {
      posts.cachedPost(props.postId!)?.loadComments();
      return;
    }
  })


  const onPostClick = (post: Post) => {
  }


  return (
    <PostsContainer gap={5} style={props.style}>
      <Show when={props.showCreateNew}><NewPostArea/></Show>
      <For each={cachedPosts()}>
        {(post, i) => (
          <PostItem onClick={onPostClick} post={post} />
        )}
      </For>
    </PostsContainer>
  )
}



function PostNotification (props: {notification: RawPostNotification}) {
  const {posts} = useStore();
  const {createPortal} = useCustomPortal();


  const Reply = () => {
    posts.pushPost(props.notification.post!);
    const cachedPost = () => posts.cachedPost(props.notification.post?.id!)

    const showPost = () => createPortal?.((close) => <ViewPostModal close={close} postId={props.notification.post?.id!} />)

    return (
      <FlexRow gap={5} style={{"align-items": 'center'}} onclick={showPost}>
        <Icon name="reply" color="var(--primary-color)" />
        <Link onclick={(e) => e.stopPropagation()} href={RouterEndpoints.PROFILE(props.notification.by.id)}><Avatar hexColor={props.notification.by.hexColor} size={30} /></Link>
        <FlexColumn gap={2}>
          <FlexRow gap={5}  style={{"align-items": 'center'}}>
            <Text size={14}><strong>{props.notification.by.username}</strong> replied to your Post!</Text>
            <Text opacity={0.6} size={12}>{formatTimestamp(props.notification.createdAt)}</Text>
          </FlexRow>
          <div style={{opacity: 0.6}}><Markup text={cachedPost()?.content!} /></div>
        </FlexColumn>
      </FlexRow>
    )
  }
  
  const Followed = () => {
    return (
      <Link href={RouterEndpoints.PROFILE(props.notification.by.id)} style={{"text-decoration": 'none'}} >
        <FlexRow gap={5} style={{"align-items": 'center'}}>
          <Icon name="add_circle" color="var(--primary-color)" />
          <Avatar hexColor={props.notification.by.hexColor} size={30} />
          <FlexRow gap={2} style={{"align-items": 'center'}}>
            <Text size={14}><strong>{props.notification.by.username}</strong> followed you!</Text>
            <Text opacity={0.6} size={12}>{formatTimestamp(props.notification.createdAt)}</Text>
          </FlexRow>
        </FlexRow>
      </Link>
    )
  }

  const Liked = () => {
    posts.pushPost(props.notification.post!);
    const cachedPost = () => posts.cachedPost(props.notification.post?.id!)

    const showPost = () => createPortal?.((close) => <ViewPostModal close={close} postId={props.notification.post?.id!} />)

    return (
      <FlexRow gap={5} style={{"align-items": 'center'}} onclick={showPost}>
        <Icon name="favorite" color="var(--primary-color)" />
        <Link onclick={(e) => e.stopPropagation()} href={RouterEndpoints.PROFILE(props.notification.by.id)}><Avatar hexColor={props.notification.by.hexColor} size={30} /></Link>
        <FlexColumn gap={2}>
          <FlexRow gap={5} style={{"align-items": 'center'}}>
            <Text size={14}><strong>{props.notification.by.username}</strong> liked your post!</Text>
            <Text opacity={0.6} size={12}>{formatTimestamp(props.notification.createdAt)}</Text>
          </FlexRow>
          <div style={{opacity: 0.6}}><Markup text={cachedPost()?.content!} /></div>
        </FlexColumn>
      </FlexRow>
    )
  }




  return (
    <PostContainer>

      <Show when={props.notification.type === PostNotificationType.LIKED}>
        <Liked/>
      </Show>

      <Show when={props.notification.type === PostNotificationType.FOLLOWED}>
        <Followed/>
      </Show>

      <Show when={props.notification.type === PostNotificationType.REPLIED}>
        <Reply/>
      </Show>
      
    </PostContainer>
  )
}


export function PostNotificationsArea (props: { style?: JSX.CSSProperties}) {
  const [notifications, setNotifications] = createSignal<RawPostNotification[]>([]);
  
  onMount(async () => {
    const fetchNotifications = await getPostNotifications();
    setNotifications(fetchNotifications)
  })
  return (
    <PostsContainer gap={5} style={props.style}>
      <For each={notifications()}>
        {notification => <PostNotification notification={notification} />}
      </For>
    </PostsContainer>
  )
}


function ViewPostModal (props: { close(): void; postId: string}) {
  const [postId, setPostId] = createSignal(props.postId);


  const {posts} = useStore();

  const post = () => posts.cachedPost(postId());

  const [commentedToIds, setCommentedToIds] = createSignal<string[]>([]);
  const commentToList = () => commentedToIds().map(postId => posts.cachedPost(postId))


  onMount(async () => {
    const newPost = await getPost(postId());
    newPost?.loadComments();
  })

  const getPost = async (postId: string) => {
    const newPost = await posts.fetchAndPushPost(postId);
    newPost && setCommentedToIds([newPost.id, ...commentedToIds()]);
    if (newPost?.commentToId) getPost(newPost.commentToId);

    return newPost;
  }

  return (
    <Modal close={props.close} title="Post" class={css`width: 600px; max-height: 700px; height: 100%;`}>
      <FlexColumn style={{overflow: "auto", height: "100%"}}>
        <Show when={post()}>
          <FlexColumn gap={5}>
            <For each={commentToList()}>
              {post => <PostItem post={post!} />}
            </For>
          <NewPostArea postId={postId()}/>
          </FlexColumn>
          <Text style={{"margin-bottom": "10px", "margin-top": "10px"}}>Replies</Text>
          <PostsArea style={{overflow: 'initial'}} postId={post()?.id} />
        </Show>
      </FlexColumn>
    </Modal>
  )
}