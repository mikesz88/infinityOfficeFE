import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const router = useRouter();
  const [roomName, setRoomName] = useState('');
  const ownerId = 'f934f7b4-4eb4-434d-a0e6-088f5376649f';

  const joinRoom = () => {
    router.push(`/room/${ownerId}`);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Native WebRTC API with NextJS</title>
        <meta
          name='description'
          content='Use Native WebRTC API for video conferencing'
        />
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <main className={styles.main}>
        <h1>Lets join a room!</h1>
        <input
          onChange={(e) => setRoomName(e.target.value)}
          value={roomName}
          className={styles['room-name']}
        />
        <button
          onClick={joinRoom}
          type='button'
          className={styles['join-room']}
        >
          Join Room
        </button>
      </main>
    </div>
  );
}

