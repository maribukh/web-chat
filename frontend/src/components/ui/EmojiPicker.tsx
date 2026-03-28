const EMOJIS = [
  '😀','😂','😍','🥰','😎','🤔','😅','🥲',
  '😊','😏','🤩','😭','😤','🤯','😴','🥳',
  '🙏','👍','👎','👏','🤝','💪','✌️','🫶',
  '❤️','🔥','⭐','✨','🎉','🎊','💯','🚀',
  '😂','🤣','😆','😁','😋','🤓','😜','🤪',
  '😬','🫠','🤭','🫡','🤗','😇','🥹','😮',
  '😱','😳','🫢','😈','👻','💀','🤖','🎭',
  '🌈','☀️','🌙','⚡','💧','🌊','🍕','🍔',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className="emoji-picker">
      <div className="emoji-grid">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className="emoji-btn"
            onClick={() => onSelect(emoji)}
            title={emoji}
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
