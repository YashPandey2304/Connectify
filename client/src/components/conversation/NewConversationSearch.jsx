import { useState, useRef, useEffect } from "react";
import userService from "../../services/userService";
import Avatar from "../common/Avatar";
import "./NewConversationSearch.css";

/**
 * WHY debounce the search input?
 * Without it, every single keystroke fires an API request — typing
 * "alice" would trigger 5 requests, mostly for intermediate results the
 * user never even sees. Debouncing waits for a short pause in typing
 * before firing, which is the standard pattern for any search-as-you-type
 * UI and meaningfully cuts down on unnecessary backend load.
 */
export default function NewConversationSearch({ onSelectUser }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await userService.searchUsers(query.trim());
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms pause before firing — long enough to skip
    // intermediate keystrokes, short enough to still feel instant.

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (user) => {
    onSelectUser(user);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="new-conv-search">
      <input
        type="text"
        placeholder="Search people..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="new-conv-input"
      />

      {query.trim() && (
        <div className="new-conv-results">
          {searching && <div className="new-conv-status">Searching...</div>}
          {!searching && results.length === 0 && (
            <div className="new-conv-status">No users found</div>
          )}
          {results.map((user) => (
            <button key={user._id} className="new-conv-result" onClick={() => handleSelect(user)}>
              <Avatar name={user.name} profilePicture={user.profilePicture} size={32} />
              <div>
                <div className="new-conv-result-name">{user.name}</div>
                <div className="new-conv-result-email">{user.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
