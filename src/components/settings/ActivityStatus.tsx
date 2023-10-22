import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import Text from '@/components/ui/Text';
import { css, styled } from 'solid-styled-components';
import { FlexColumn, FlexRow } from '../ui/Flexbox';
import useStore from '@/chat-api/store/useStore';
import Breadcrumb, { BreadcrumbItem } from '../ui/Breadcrumb';
import { t } from 'i18next';
import SettingsBlock from '../ui/settings-block/SettingsBlock';
import { Notice } from '../ui/Notice';
import { electronWindowAPI, Program } from '@/common/Electron';
import Button from '../ui/Button';
import DropDown, { DropDownItem } from '../ui/drop-down/DropDown';
import Block from '../ui/settings-block/Block';
import { getStorageObject, StorageKeys, useReactiveLocalStorage } from '@/common/localStorage';
import { emitActivityStatus } from '@/chat-api/emits/userEmits';

const Container = styled("div")`
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px;
  flex-shrink: 0;
`;


const Options = styled("div")`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 10px;
  flex-shrink: 0;

`;


const BlockContent = styled("div")`
  position: absolute;
  inset: 0;
  z-index: 1111;
  cursor: not-allowed;
`;


export default function WindowSettings() {
  const { header } = useStore();


  createEffect(() => {
    header.updateHeader({
      title: "Settings - Activity Status",
      iconName: 'settings',
    });
  })

  const isElectron = electronWindowAPI()?.isElectron;


  return (
    <Container>
      <Breadcrumb>
        <BreadcrumbItem href='/app' icon='home' title="Dashboard" />
        <BreadcrumbItem title={t('settings.drawer.activity-status')!} />
      </Breadcrumb>
      <Show when={!isElectron}>
        <Notice type='info' description='To modify these settings, you must download the Nerimity desktop app.' />
      </Show>

      <Options>
        <Show when={!isElectron}><BlockContent/></Show>
        <ProgramOptions />
      </Options>

    </Container>
  )
}

function ProgramOptions() {
  const [programs, setPrograms] = createSignal<Program[]>([]);
  const [addedPrograms, setAddedPrograms] = useReactiveLocalStorage<(Program & {action: string})[]>(StorageKeys.PROGRAM_ACTIVITY_STATUS, []);

  const getPrograms = () => {
    electronWindowAPI()?.getRunningPrograms(addedPrograms()).then(setPrograms);
  }

  const restartActivityStatus = () => {
    electronWindowAPI()?.restartActivityStatus(addedPrograms());
  }

  onMount(() => {
    if (!electronWindowAPI()?.isElectron) return;
    getPrograms();
    const timerId = window.setInterval(() => {
      getPrograms()
    }, 3000)

    onCleanup(() => {
      window.clearInterval(timerId)
    })
  })
  const dropDownItems = () => {
    return programs().map((program) => ({
      id: program.filename,
      label: program.name,  
      description: program.filename,
      data: program
    })) satisfies DropDownItem[]
  }

  const addProgram = (item: DropDownItem) => {
    const program = {
      ...item.data,
      action: "Playing"
    }
    setAddedPrograms([...addedPrograms(), program]);
    getPrograms();
    restartActivityStatus()
  }

  const removeProgram = (program: Program) => {
    setAddedPrograms(addedPrograms().filter(p => p !== program));
    getPrograms();
    restartActivityStatus()
  }

  return (

    <FlexColumn>
      <SettingsBlock icon='games' label='Activity Status' description="Share what you're up to with everyone." header={!!addedPrograms().length}>
        <Show when={addedPrograms().length + 1} keyed><DropDown onChange={addProgram} items={dropDownItems()} class={css`width: 200px;`} /></Show>
      </SettingsBlock>
      
      <For each={addedPrograms()}>
        {(item, i) => (
          <Block borderTopRadius={false} borderBottomRadius={i() === addedPrograms().length - 1}>
           <FlexRow class={css`flex: 1;`}>
            <FlexColumn gap={4}  class={css`flex: 1;`}>
                <FlexRow gap={5} itemsCenter>
                  <Text bold>{item.action}</Text>
                  <Text opacity={0.8}>{item.name}</Text>
                </FlexRow>
                <Text opacity={0.6} size={14}>{item.filename}</Text>
              </FlexColumn>
              <Button iconName='delete' onClick={() => removeProgram(item)} label='Delete' color='var(--alert-color)' />
              <Button iconName='edit' label='Edit' />
           </FlexRow>
          </Block>
        )}
      </For>
    </FlexColumn>
  )
}