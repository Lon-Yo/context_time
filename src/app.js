// app.js
import React, { useState, useEffect, useRef } from 'react';
import {
  format,
  parseISO,
  differenceInYears,
  isBefore,
  isAfter,
  startOfDay,
  compareAsc,
} from 'date-fns';
import { FaThumbtack, FaBars, FaSearch, FaCalendar } from 'react-icons/fa';
// Using a chat bubble icon with "...":
import { MdChatBubbleOutline } from 'react-icons/md'; 
import './app.css';
import { v4 as uuidv4 } from 'uuid';

const TimelineItem = React.forwardRef(function TimelineItem(
  { event, onUpdateEvent, onTogglePin, onDeleteEvent, onContextMenu, onDeleteTag, onEditTag, onTagEdited, isMobile, allTags, durations, originalTimelineData },
  ref
) {
  const [isEditing, setIsEditing] = useState(event.isNew || false);
  const [editedText, setEditedText] = useState(event.text.toLowerCase());
  const [editedDate, setEditedDate] = useState(formatDateForInput(event.date));
  const [editedTags, setEditedTags] = useState((event.tags || []).map(t => t.toLowerCase()));
  const [isHovered, setIsHovered] = useState(false);

  const editRef = useRef(null);
  const textAreaRef = useRef(null);
  const touchTimeout = useRef(null);

  const [showOptions, setShowOptions] = useState(false);
  const [showTagDeleteMenu, setShowTagDeleteMenu] = useState(false);

  const [newTagInput, setNewTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [tagBeingEdited, setTagBeingEdited] = useState(null);
  const [tagEditInput, setTagEditInput] = useState('');
  const [tagsFinalized, setTagsFinalized] = useState(false);

  useEffect(() => {
    setEditedText(event.text.toLowerCase());
    setEditedTags((event.tags || []).map(t => t.toLowerCase()));
  }, [event]);

  useEffect(() => {
    const handleClickOutside = (eventOutside) => {
      if (!isEditing) return;
      if (editRef.current && !editRef.current.contains(eventOutside.target)) {
        if (tagBeingEdited || newTagInput.trim()) {
          finalizeTagInput();
          setTagsFinalized(true);
        } else {
          handleSave(true);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, editedText, editedDate, editedTags, newTagInput, tagBeingEdited, tagsFinalized]);

  useEffect(() => {
    if (isEditing) {
      setTagsFinalized(false);
    }
  }, [isEditing]);

  useEffect(() => {
    updateTagSuggestions();
  }, [newTagInput, allTags, editedTags, durations, tagBeingEdited, tagEditInput]);

  const finalizeTagInput = () => {
    if (newTagInput.trim()) {
      handleAddTag(newTagInput.trim());
      setNewTagInput('');
    }
    if (tagBeingEdited && tagEditInput.trim()) {
      handleFinishTagEdit();
    }
    if (tagBeingEdited && !tagEditInput.trim()) {
      setTagBeingEdited(null);
      setTagEditInput('');
    }
  };

  const updateTagSuggestions = () => {
    let query;
    if (tagBeingEdited) {
      query = tagEditInput.trim().toLowerCase();
    } else {
      query = newTagInput.trim().toLowerCase();
    }

    if (!query) {
      setTagSuggestions([]);
      return;
    }
    const suggestions = getAllTagSuggestions(query);
    setTagSuggestions(suggestions);
  };

  const getAllTagSuggestions = (query) => {
    const normalSuggestions = allTags.filter(
      (t) => t.includes(query) && !editedTags.includes(t)
    );

    let durationSuggestions = [];
    if (query.startsWith('#start ') || query.startsWith('#stop ')) {
      const prefix = query.startsWith('#start ') ? '#start ' : '#stop ';
      const namePart = query.slice(prefix.length).trim();

      const nameExistsGlobal = originalTimelineData.some(d =>
        (d.tags || []).some(existingTag => {
          const lower = existingTag.toLowerCase();
          if ((lower.startsWith('#start ') || lower.startsWith('#stop '))) {
            const existingName = lower.split(' ').slice(1).join(' ');
            return existingName.trim() === namePart;
          }
          return false;
        })
      );
      if (!nameExistsGlobal) {
        durationSuggestions = [prefix + namePart];
      }
    }

    const allSugs = [...normalSuggestions, ...durationSuggestions];
    return allSugs.slice(0, 10);
  };

  const handleSave = (fromOutsideClick = false) => {
    if (!editedText.trim()) {
      if (event.isNew) {
        const shouldContinueEditing = window.confirm('Text is required. Cancel creation of this event?');
        if (!shouldContinueEditing) {
          onDeleteEvent(event.id);
          return;
        } else {
          return;
        }
      } else {
        alert('Event text cannot be empty.');
        return;
      }
    }
    const parsedDate = new Date(editedDate);
    if (isNaN(parsedDate.getTime())) {
      alert('Invalid date format. Please enter a valid date and time.');
      return;
    }

    onUpdateEvent({
      ...event,
      text: editedText.toLowerCase(),
      date: format(parsedDate, "yyyy-MM-dd'T'HH:mm:ss"),
      tags: editedTags.map(t => t.toLowerCase()),
    });
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (tagBeingEdited) {
        handleFinishTagEdit();
      } else if (newTagInput.trim()) {
        handleAddTag(newTagInput.trim());
        setNewTagInput('');
      } else {
        if (!tagsFinalized && (tagBeingEdited || newTagInput.trim())) {
          finalizeTagInput();
          setTagsFinalized(true);
        } else {
          handleSave();
        }
      }
    }
  };

  const handleAddTag = (tag) => {
    tag = tag.toLowerCase();
    if (tag.startsWith('#') && !(tag.startsWith('#start ') || tag.startsWith('#stop '))) {
      alert('Invalid special tag. Only "#start name" or "#stop name" allowed when using "#".');
      return;
    }
    if (tag.startsWith('@') && tag.length <= 1) {
      alert('Invalid person tag. Must be "@name".');
      return;
    }
    if (!tag.startsWith('#') && !tag.startsWith('@')) {
      if (tag.includes('@') || tag.includes('#')) {
        alert('Normal tags cannot contain # or @ symbols.');
        return;
      }
    }

    const hasStartOrStop = editedTags.some(t => t.startsWith('#start ') || t.startsWith('#stop '));
    if ((tag.startsWith('#start ') || tag.startsWith('#stop ')) && hasStartOrStop) {
      alert('Cannot have both #start and #stop tags on the same event.');
      return;
    }

    if (tag.startsWith('#start ') || tag.startsWith('#stop ')) {
      const prefix = tag.startsWith('#start ') ? '#start ' : '#stop ';
      const name = tag.slice(prefix.length).trim();
      const nameExistsGlobal = originalTimelineData.some(d =>
        (d.tags || []).some(existingTag => {
          const lower = existingTag.toLowerCase();
          if ((lower.startsWith('#start ') || lower.startsWith('#stop '))) {
            const existingName = lower.split(' ').slice(1).join(' ');
            return existingName.trim() === name;
          }
          return false;
        })
      );
      if (nameExistsGlobal) {
        alert(`A duration with name "${name}" already exists. You cannot add another #start or #stop for the same duration name.`);
        return;
      }
    }

    if (!editedTags.includes(tag)) {
      if (tagBeingEdited) {
        const oldTag = tagBeingEdited.oldTag;
        const updated = editedTags.map(t => t === oldTag ? tag : t);
        setEditedTags(updated);
        setTagBeingEdited(null);
        setTagEditInput('');
      } else {
        setEditedTags([...editedTags, tag]);
      }
    }
  };

  const startTagEdit = (oldTag) => {
    setTagBeingEdited({ oldTag });
    setTagEditInput(oldTag);
  };

  const handleFinishTagEdit = () => {
    const newTagName = tagEditInput.trim().toLowerCase();
    if (!newTagName) {
      setTagBeingEdited(null);
      setTagEditInput('');
      return;
    }
    handleAddTag(newTagName);
  };

  const classForTag = (tag) => {
    const lower = tag.toLowerCase();
    if (lower.startsWith('@')) {
      return 'tag tag-person';
    }
    if (lower.startsWith('#start ') || lower.startsWith('#stop ')) {
      return 'tag tag-range';
    }
    return 'tag';
  };

  const eventTags = editedTags;

  const tagContextMenu = (e, tag) => {
    onContextMenu(e, event.id, tag);
  };

  const handleTouchStart = () => {
    if (!event.isToday) {
      touchTimeout.current = setTimeout(() => {
        setShowOptions(true);
      }, 700);
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(touchTimeout.current);
  };

  const handleOptionSelect = (option) => {
    if (option === 'pin') {
      onTogglePin(event);
    } else if (option === 'delete') {
      const confirmDelete = window.confirm('Are you sure you want to delete this event?');
      if (confirmDelete) {
        onDeleteEvent(event.id);
      }
    }
    setShowOptions(false);
  };

  const showPin = (!isEditing && !event.isToday && ((isMobile ? false : isHovered) || event.pinned));

  return (
    <div
      className="timeline-item"
      onMouseEnter={() => { if(!event.isToday && !isMobile) setIsHovered(true); }}
      onMouseLeave={() => { if(!isMobile) setIsHovered(false); }}
      onContextMenu={(e) => { if(!event.isToday) onContextMenu(e, event.id); }}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      ref={ref}
    >
      <div className="timeline-marker"></div>
      <div
        className="timeline-content"
        ref={editRef}
        onClick={() => {
          if (!event.isToday && !tagBeingEdited) {
            setIsEditing(true);
          }
        }}
      >
        {isEditing ? (
          <div className="edit-container">
            <input
              type="datetime-local"
              className="timeline-date-edit"
              value={editedDate}
              onChange={(e) => setEditedDate(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyPress={handleKeyPress}
              onBlur={() => {
                if (!editedText.trim() && textAreaRef.current) {
                  textAreaRef.current.focus();
                }
              }}
              min="1900-01-01T00:00"
              max="2100-12-31T23:59"
            />
            <textarea
              className="timeline-text-edit"
              ref={textAreaRef}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value.toLowerCase())}
              onClick={(e) => e.stopPropagation()}
              onKeyPress={handleKeyPress}
            />
            <div className="tags-edit-section">
              <div className="tags-list">
                {editedTags.map((tag) =>
                  tagBeingEdited && tagBeingEdited.oldTag === tag ? (
                    <input
                      key={tag}
                      className="tag-input editing"
                      value={tagEditInput}
                      onChange={(e) => setTagEditInput(e.target.value.toLowerCase())}
                      onKeyPress={handleKeyPress}
                      onBlur={finalizeTagInput}
                    />
                  ) : (
                    <span
                      className={classForTag(tag)}
                      key={tag}
                      onContextMenu={(ev) => tagContextMenu(ev, tag)}
                      onTouchStart={
                        isMobile
                          ? (evt) => {
                              const { clientX, clientY } = evt.touches && evt.touches[0] ? evt.touches[0] : evt;
                              const fakeEvent = {
                                preventDefault: () => {},
                                clientX,
                                clientY
                              };
                              touchTimeout.current = setTimeout(() => {
                                onContextMenu(fakeEvent, event.id, tag);
                              }, 700);
                            }
                          : undefined
                      }
                      onTouchEnd={isMobile ? () => clearTimeout(touchTimeout.current) : undefined}
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
              {!tagBeingEdited && (
                <div className="tag-input-container">
                  <input
                    type="text"
                    className="tag-input"
                    placeholder="Add tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value.toLowerCase())}
                    onKeyPress={handleKeyPress}
                    onBlur={finalizeTagInput}
                  />
                  {tagSuggestions.length > 0 && (
                    <div className="tag-suggestions">
                      {tagSuggestions.map((s) => (
                        <div
                          className="tag-suggestion-item"
                          key={s}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            handleAddTag(s);
                            setNewTagInput('');
                          }}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="timeline-date">
              {format(parseISO(event.date), 'MMMM d, yyyy h:mm a')}
            </div>
            <div className="timeline-text">{event.text}</div>
            <div className="tags-display">
              {event.tags?.map((tag) => (
                <span
                  key={tag}
                  className={classForTag(tag)}
                  onContextMenu={(e) => !event.isToday && tagContextMenu(e, tag)}
                  onTouchStart={
                    isMobile && !event.isToday
                      ? (evt) => {
                          const { clientX, clientY } = evt.touches && evt.touches[0] ? evt.touches[0] : evt;
                          const fakeEvent = {
                            preventDefault: () => {},
                            clientX,
                            clientY
                          };
                          touchTimeout.current = setTimeout(() => {
                            onContextMenu(fakeEvent, event.id, tag);
                          }, 700);
                        }
                      : undefined
                  }
                  onTouchEnd={isMobile ? () => clearTimeout(touchTimeout.current) : undefined}
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}

        {showPin && (
          <div className="timeline-actions">
            <button
              className="pin-button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(event);
              }}
              aria-label={event.pinned ? 'Unpin Event' : 'Pin Event'}
              title={event.pinned ? 'Unpin Event' : 'Pin Event'}
            >
              <FaThumbtack color="#000000" />
            </button>
          </div>
        )}
      </div>

      {isMobile && showOptions && !showTagDeleteMenu && !event.isToday && (
        <div className="mobile-options-modal" style={{overflowY:'auto',maxHeight:'80vh', textAlign:'left'}}>
          <button onClick={() => handleOptionSelect('pin')} className="option-button">
            {event.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button onClick={() => handleOptionSelect('delete')} className="option-button">
            Delete Event
          </button>
          {eventTags.length > 0 && (
            <button onClick={() => {
              setShowTagDeleteMenu(true);
              setShowOptions(false);
            }} className="option-button">
              Delete Tag
            </button>
          )}
          <button
            onClick={() => setShowOptions(false)}
            className="option-button cancel-button"
          >
            Cancel
          </button>
        </div>
      )}

      {isMobile && showTagDeleteMenu && (
        <div className="mobile-options-modal" style={{overflowY:'auto',maxHeight:'80vh', textAlign:'left'}}>
          {eventTags.length === 0 ? (
            <button
              onClick={() => {
                setShowTagDeleteMenu(false);
              }}
              className="option-button"
            >
              No Tags to Delete
            </button>
          ) : (
            <>
              {eventTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    const confirmDelete = window.confirm(`Are you sure you want to delete the tag "${tag}"?`);
                    if (confirmDelete) {
                      onDeleteTag(event.id, tag);
                    }
                    setShowTagDeleteMenu(false);
                  }}
                  className="option-button"
                >
                  Delete "{tag}"
                </button>
              ))}
              <button
                onClick={() => {
                  setShowTagDeleteMenu(false);
                }}
                className="option-button cancel-button"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});

function App() {
  const initialData = [
    {
      id: uuidv4(),
      date: '1966-09-18T14:30:00',
      text: 'fred was born.',
      pinned: false,
      tags: ['normal tag', 'apple'],
    },
    {
      id: uuidv4(),
      date: '1980-04-10T09:15:00',
      text: 'tom was born.',
      pinned: false,
      tags: ['@fred', '@robotics_club'],
    },
    {
      id: uuidv4(),
      date: '1980-03-07T12:00:00',
      text: 'marie rowe was born.',
      pinned: false,
      tags: ['#start test_duration'],
    },
    {
      id: uuidv4(),
      date: '1982-08-26T08:45:00',
      text: 'i was born duson, louisiana.',
      pinned: false,
      tags: [],
    },
    {
      id: uuidv4(),
      date: '2013-01-26T16:20:00',
      text: 'michael smith married tina rowe.',
      pinned: false,
      tags: [],
    },
    {
      id: uuidv4(),
      date: '2014-07-15T10:30:00',
      text: 'james thomas was born.',
      pinned: false,
      tags: [],
    },
    {
      id: uuidv4(),
      date: '2016-09-05T14:00:00',
      text: 'alexander bell graduated high school.',
      pinned: false,
      tags: [],
    },
    {
      id: uuidv4(),
      date: '2020-01-01T10:00:00',
      text: 'a event marking the end of test_duration.',
      pinned: false,
      tags: ['#stop test_duration'],
    },
    {
      id: uuidv4(),
      date: '2025-01-01T12:00:00',
      text: 'Event in the future.',
      pinned: false,
      tags: [],
    },
    {
      id: uuidv4(),
      date: '2024-12-15T09:30:00',
      text: 'Another future event.',
      pinned: false,
      tags: ['@intralox intelligence','team meetings']
    },
  ];

  const [originalTimelineData, setOriginalTimelineData] = useState(initialData);
  const [timelineData, setTimelineData] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPinsOnly, setShowPinsOnly] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    eventId: null,
    tagToDelete: null,
    tagToEdit: null,
    mode: null,
  });
  const [upcomingSortMode, setUpcomingSortMode] = useState('month-day');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const [newEventId, setNewEventId] = useState(null);

  const [allTags, setAllTags] = useState([]);
  const [durations, setDurations] = useState({});

  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchableWordsRef = useRef([]);

  const [viewMode, setViewMode] = useState('timeline'); 
  const [hamburgerOpen, setHamburgerOpen] = useState(false);

  const [isChatMode, setIsChatMode] = useState(false); 

  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const itemRefs = useRef({});
  let futureLabelShown = false;

  useEffect(() => {
    if (originalTimelineData.length > 0) {
      const dates = originalTimelineData.map(e => parseISO(e.date)).sort(compareAsc);
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      if (!startDateFilter && !endDateFilter) {
        setStartDateFilter(format(minDate, 'yyyy-MM-dd'));
        setEndDateFilter(format(maxDate, 'yyyy-MM-dd'));
      }
    }
  }, [originalTimelineData, startDateFilter, endDateFilter]);

  function dateInRange(date) {
    if (startDateFilter && endDateFilter) {
      const d = parseISO(date);
      const start = parseISO(startDateFilter);
      const end = parseISO(endDateFilter);
      return (isAfter(d, start) || +d === +start) && (isBefore(d, end) || +d === +end);
    }
    return true;
  }

  function filterTimelineData(data, query, pinsOnly) {
    let filteredData = data;

    if (query.trim()) {
      const groups = query
        .split('+')
        .map((group) => group.trim().toLowerCase())
        .filter((group) => group);

      const parsedGroups = groups.map((group) => group.split(' ').filter((term) => term));

      const matchesEvent = (event) => {
        if (event.isToday) return false;
        const formattedDate = format(parseISO(event.date), 'MMMM d, yyyy h:mm a').toLowerCase();
        const textContent = event.text.toLowerCase();
        const tagsContent = (event.tags || []).map((t) => t.toLowerCase());

        return parsedGroups.some((groupTerms) =>
          groupTerms.every(
            (term) =>
              textContent.includes(term) ||
              formattedDate.includes(term) ||
              tagsContent.some((tag) => tag.includes(term))
          )
        );
      };

      filteredData = filteredData.filter((event) => matchesEvent(event) || (event.pinned && !event.isToday));
    } else {
      filteredData = filteredData.filter((event) => !event.isToday || (pinsOnly && event.pinned));
    }

    if (pinsOnly) {
      filteredData = filteredData.filter(e => e.pinned);
    }

    filteredData = filteredData.filter(e => dateInRange(e.date));

    filteredData.sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));
    return filteredData;
  }

  function updateAllTags(data) {
    const tagsSet = new Set();
    data.forEach((event) => {
      (event.tags || []).forEach((t) => tagsSet.add(t.toLowerCase()));
    });
    setAllTags(Array.from(tagsSet));
  }

  function updateDurations(data) {
    const dur = {};
    data.forEach((event) => {
      const eventDate = parseISO(event.date);
      (event.tags || []).forEach((tag) => {
        const lower = tag.toLowerCase();
        if (lower.startsWith('#start ') || lower.startsWith('#stop ')) {
          const parts = lower.split(' ');
          const name = parts.slice(1).join(' ').trim();
          if (!dur[name]) {
            dur[name] = { startDate: null, stopDate: null };
          }
          if (lower.startsWith('#start ')) {
            if (!dur[name].startDate || isBefore(eventDate, parseISO(dur[name].startDate))) {
              dur[name].startDate = event.date;
            }
          }
          if (lower.startsWith('#stop ')) {
            if (!dur[name].stopDate || isBefore(eventDate, parseISO(dur[name].stopDate))) {
              dur[name].stopDate = event.date;
            }
          }
        }
      });
    });
    setDurations(dur);
  }

  function updateSearchableWords(data) {
    const wordsSet = new Set();
    data.forEach((event) => {
      event.text.toLowerCase().split(/\s+/).forEach(w => { if (w.length > 1) wordsSet.add(w); });
      (event.tags || []).forEach(tag => { if (tag.length > 1) wordsSet.add(tag.toLowerCase()); });
    });
    searchableWordsRef.current = Array.from(wordsSet);
  }

  function getTimelineDataWithToday() {
    const todayDate = new Date();
    const todayEvent = {
      id: 'today',
      date: format(todayDate, "yyyy-MM-dd'T'HH:mm:ss"),
      text: 'today',
      isToday: true,
      tags: [],
    };
    const dataWithToday = [...timelineData, todayEvent];
    dataWithToday.sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));
    return dataWithToday;
  }

  const timelineDataWithToday = getTimelineDataWithToday();
  
  useEffect(() => {
    if (showInfoModal || showUpcomingModal || showStatsModal || showDateRangePicker) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  }, [showInfoModal, showUpcomingModal, showStatsModal, showDateRangePicker]);

  useEffect(() => {
    updateAllTags(originalTimelineData);
    updateDurations(originalTimelineData);
    updateSearchableWords(originalTimelineData);
  }, [originalTimelineData]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (newEventId && itemRefs.current[newEventId]) {
      itemRefs.current[newEventId].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setNewEventId(null);
    }
  }, [timelineDataWithToday, newEventId]);

  function handleSearchChange(event) {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);
    const filtered = filterTimelineData(originalTimelineData, query, showPinsOnly);
    setTimelineData(filtered);
    updateSearchQuerySuggestions(query);
  }

  function updateSearchQuerySuggestions(query) {
    if (!query.trim()) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      return;
    }
    const suggestions = searchableWordsRef.current.filter(w => w.includes(query));
    if (suggestions.length > 0) {
      setSearchSuggestions(suggestions.slice(0, 10));
      setShowSearchSuggestions(true);
    } else {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
    }
  }

  function applySearchSuggestion(suggestion) {
    const q = suggestion.toLowerCase();
    setSearchQuery(q);
    const filtered = filterTimelineData(originalTimelineData, q, showPinsOnly);
    setTimelineData(filtered);
    setShowSearchSuggestions(false);
  }

  function clearSearch() {
    setSearchQuery('');
    const filtered = filterTimelineData(originalTimelineData, '', showPinsOnly);
    setTimelineData(filtered);
    setSearchSuggestions([]);
    setShowSearchSuggestions(false);
  }

  function toggleShowPinsOnly() {
    const newShowPinsOnly = !showPinsOnly;
    setShowPinsOnly(newShowPinsOnly);
    const filtered = filterTimelineData(originalTimelineData, searchQuery, newShowPinsOnly);
    setTimelineData(filtered);
  }

  function toggleUpcomingSortMode() {
    setUpcomingSortMode((prevMode) => (prevMode === 'month-day' ? 'absolute' : 'month-day'));
  }

  function handleUpdateEvent(updatedEvent) {
    const updatedOriginalData = originalTimelineData.map((event) =>
      event.id === updatedEvent.id
        ? {
            ...event,
            text: updatedEvent.text.toLowerCase(),
            date: updatedEvent.date,
            isNew: false,
            tags: (updatedEvent.tags || []).map(t => t.toLowerCase()),
          }
        : event
    );
    setOriginalTimelineData(updatedOriginalData);
    const filtered = filterTimelineData(updatedOriginalData, searchQuery, showPinsOnly);
    setTimelineData(filtered);
  }

  function handleTogglePin(toggledEvent) {
    const updatedOriginalData = originalTimelineData.map((event) =>
      event.id === toggledEvent.id ? { ...event, pinned: !event.pinned } : event
    );
    setOriginalTimelineData(updatedOriginalData);

    const filtered = filterTimelineData(updatedOriginalData, searchQuery, showPinsOnly);
    setTimelineData(filtered);
  }

  function handleClearPins() {
    const updatedOriginalData = originalTimelineData.map((event) => ({
      ...event,
      pinned: false,
    }));
    setOriginalTimelineData(updatedOriginalData);
    setShowPinsOnly(false);
    const filtered = filterTimelineData(updatedOriginalData, '', false);
    setTimelineData(filtered);
  }

  function handleAddNewEvent() {
    if (viewMode === 'timeline') {
      const defaultDate = format(new Date(), "yyyy-MM-dd'T'HH:mm");
      const newEvent = {
        id: uuidv4(),
        date: defaultDate,
        text: '',
        pinned: false,
        isNew: true,
        tags: [],
      };
      const updatedOriginalData = [newEvent, ...originalTimelineData];
      setOriginalTimelineData(updatedOriginalData);

      const filtered = filterTimelineData(updatedOriginalData, searchQuery, showPinsOnly);
      setTimelineData(filtered);
      setNewEventId(newEvent.id);
    } else {
      alert('Creating new tag (placeholder).');
    }
  }

  function handleDeleteEvent(eventId) {
    const updatedOriginalData = originalTimelineData.filter((event) => event.id !== eventId);
    setOriginalTimelineData(updatedOriginalData);
    const filtered = filterTimelineData(updatedOriginalData, searchQuery, showPinsOnly);
    setTimelineData(filtered);
  }

  function handleToggleMode(mode) {
    if (mode === 'chat') {
      setIsChatMode(true);
    } else {
      setIsChatMode(false);
    }
  }

  // Determine default start/end
  let defaultStart = '';
  let defaultEnd = '';
  if (originalTimelineData.length > 0) {
    const sortedDates = originalTimelineData.map(e => parseISO(e.date)).sort(compareAsc);
    defaultStart = format(sortedDates[0], 'yyyy-MM-dd');
    defaultEnd = format(sortedDates[sortedDates.length - 1], 'yyyy-MM-dd');
  }

  const dateFilterActive = (startDateFilter && endDateFilter && defaultStart && defaultEnd) 
    ? (startDateFilter !== defaultStart || endDateFilter !== defaultEnd)
    : false;

  function handleContextMenu(e, eventId, tag = null) {
    e.preventDefault();
    if (!isMobile) {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        eventId,
        tagToDelete: tag,
        tagToEdit: null,
        mode: null,
      });
    }
  }

  function handleDeleteTagFromEvent(eventId, tag) {
    const updatedOriginalData = originalTimelineData.map((ev) => {
      if (ev.id === eventId) {
        const newTags = (ev.tags || []).filter((t) => t !== tag);
        return { ...ev, tags: newTags };
      }
      return ev;
    });
    setOriginalTimelineData(updatedOriginalData);
    const filtered = filterTimelineData(updatedOriginalData, searchQuery, showPinsOnly);
    setTimelineData(filtered);
  }

  function handleEditTag(eventId, tag) {
    alert(`Edit tag "${tag}" for event ${eventId} (not implemented).`);
  }

  function handleTagEdited(eventId, oldTag, newTag) {
    newTag = newTag.toLowerCase();
    const updatedOriginalData = originalTimelineData.map((ev) => {
      if (ev.id === eventId) {
        const newTags = (ev.tags || []).map((t) => (t === oldTag ? newTag : t));
        return { ...ev, tags: newTags };
      }
      return ev;
    });
    setOriginalTimelineData(updatedOriginalData);
    const filtered = filterTimelineData(updatedOriginalData, searchQuery, showPinsOnly);
    setTimelineData(filtered);
  }

  const searchPlaceholder = isChatMode ? 'Chat with search results & pinned...' : (viewMode === 'timeline' ? 'Search timeline events...' : 'Search tags...');

  const pinnedCount = originalTimelineData.filter((event) => event.pinned).length;
  const hasMultiplePins = pinnedCount >= 2;

  // Group tags for tag view with colors
  const tagClassForTag = (tag) => {
    const lower = tag.toLowerCase();
    if (lower.startsWith('@')) {
      return 'tag tag-person';
    }
    if (lower.startsWith('#start ') || lower.startsWith('#stop ')) {
      return 'tag tag-range';
    }
    return 'tag';
  };

  const groupedTags = {};
  allTags.forEach(tag => {
    const c = tagClassForTag(tag);
    if (tag.startsWith('#')) {
      if (!groupedTags['Special Tags']) groupedTags['Special Tags'] = [];
      groupedTags['Special Tags'].push({tag, class:c});
    } else if (tag.startsWith('@')) {
      if (!groupedTags['People Tags']) groupedTags['People Tags'] = [];
      groupedTags['People Tags'].push({tag, class:c});
    } else {
      if (!groupedTags['Normal Tags']) groupedTags['Normal Tags'] = [];
      groupedTags['Normal Tags'].push({tag, class:c});
    }
  });

  for (let key in groupedTags) {
    groupedTags[key].sort((a, b) => a.tag.localeCompare(b.tag));
  }

  return (
    <div className="container">
      <header className="header-row">
        <button
          className="hamburger-button"
          onClick={() => setHamburgerOpen(!hamburgerOpen)}
          aria-label="Menu"
          title="Menu"
        >
          <FaBars />
        </button>
        <h1 style={{textAlign:'center', flex:1}}>Convey-i</h1>
        <div id="current-datetime" style={{textAlign:'center', marginTop:'0.5rem', flexBasis:'100%'}}>
          {format(currentDateTime, 'MMMM d, yyyy h:mm:ss a')}
        </div>
      </header>

      {hamburgerOpen && (
        <div className="hamburger-menu">
          <div className="hamburger-menu-item" onClick={() => { setViewMode('timeline'); setHamburgerOpen(false); }}>
            Timeline View
          </div>
          <div className="hamburger-menu-item" onClick={() => { setViewMode('tags'); setHamburgerOpen(false); }}>
            Tag View
          </div>
          <div className="hamburger-menu-item">
            Sign In (placeholder)
          </div>
        </div>
      )}

      {showInfoModal && (
        <div className="info-modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{position:'sticky', top:0, background:'transparent', padding:'0.5rem', display:'flex', justifyContent:'flex-end'}}>
              <button className="close-modal-button" onClick={() => setShowInfoModal(false)}>
                Close
              </button>
            </div>
            <h2>More info</h2>
            <p><strong>Current time:</strong><br/>
              Shows the live date and time based on your browser.
            </p>
            <p><strong>Timeline Events:</strong><br/>
              Click the plus sign to create a new timeline event and the page will auto scroll to the current time position in the timeline. The new timeline event defaults to the current time or you can edit with the date-time picker to record historical or future events. Text descriptions are required to create an event.
            </p>
            <p><strong>Tags:</strong><br/>
              Add tags while editing an event. After adding or picking a tag name, click outside the tag edit text area to save the tag. More than one tag can be created per event. Note: A second click outside of the timeline event saves the event.
            </p>
            <p><strong>Special Tags:</strong><br/>
              Durations are created with #start duration_name and #stop duration_name to note the start and stop of a duration with duration_name. #Start and #Stop with the same duration_name can't be on the same timeline event and #Stop must come after #start. There is only one use each of a #Start and #Stop for a given duration_name on the timeline.<br/><br/>
              People, teams, or groups can be named with tags using @name.<br/><br/>
              Generic tags are used for everything else but cannot contain '#' or '@'.<br/><br/>
              To edit or delete any tag, right-click (desktop) or long-press (mobile).
            </p>
            <p><strong>Search:</strong><br/>
              Use '+' to OR groups of search terms. Spaces between text from timeline event descriptions, dates, or tags will AND terms together in groups. Search to find events then pin for review.
            </p>
            <p><strong>Pinning Events:</strong><br/>
              Pin events to keep them visible. Toggle by clicking after hover (desktop) or long-press (mobile). Search and pin events to create a custom timeline view of events in chronological order.
            </p>
          </div>
        </div>
      )}

      {showUpcomingModal && (
        <div className="info-modal-overlay" onClick={() => setShowUpcomingModal(false)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{position:'sticky', top:0, background:'transparent', padding:'0.5rem', display:'flex', justifyContent:'flex-end'}}>
              <button className="close-modal-button" onClick={() => setShowUpcomingModal(false)}>
                Close
              </button>
            </div>
            <h2>Upcoming</h2>
            <p><strong>Details:</strong><br/>
              Displays recurring historical or future events (up to 5 of each, only for 30 days in the future). The user may sort based on month-day (ignores year) or absolute chronological order (old to new). Events for today do not show.
            </p>
            <p><strong>Sorting By:</strong><br/>
              Allows toggling between month-day sort or absolute chronological sort. 
            </p>
            <p><strong>Past:</strong><br/>
              Shows recurring historical events that are coming up again soon.
            </p>
            <p><strong>Future:</strong><br/>
              Shows future events within the next 30 days.
            </p>
          </div>
        </div>
      )}

      {showStatsModal && (
        <div className="info-modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{position:'sticky', top:0, background:'transparent', padding:'0.5rem', display:'flex', justifyContent:'flex-end'}}>
              <button className="close-modal-button" onClick={() => setShowStatsModal(false)}>
                Close
              </button>
            </div>
            <h2>Statistics</h2>
            <p><strong>Details:</strong><br/>
              Shows a summary of the number of events recorded and the duration in time they cover.
            </p>
            <p><strong>Time Span:</strong><br/>
              Displays the range of dates covered by all events and the total number of events.
            </p>
          </div>
        </div>
      )}

      {showDateRangePicker && (
        <div className="info-modal-overlay" onClick={() => setShowDateRangePicker(false)}>
          <div className="info-modal" style={{maxHeight:'50vh', textAlign:'left'}} onClick={(e) => e.stopPropagation()}>
            <h2>Select Date Range</h2>
            <p>Select a start and end date to filter events:</p>
            <div style={{marginBottom:'1rem'}}>
              <label style={{display:'block', marginBottom:'0.5rem'}}>Start Date:</label>
              <input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} />
            </div>
            <div style={{marginBottom:'1rem'}}>
              <label style={{display:'block', marginBottom:'0.5rem'}}>End Date:</label>
              <input type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} />
            </div>
            <div style={{marginTop:'1rem', display:'flex', gap:'1rem'}}>
              {!dateFilterActive ? (
                <button className="close-modal-button" style={{backgroundColor:'#000000',color:'#ffffff'}} onClick={() => {
                  const filtered = filterTimelineData(originalTimelineData, searchQuery, showPinsOnly);
                  setTimelineData(filtered);
                  // If applied and changed from defaults
                  if (startDateFilter !== defaultStart || endDateFilter !== defaultEnd) {
                    // now we have a custom filter applied
                  }
                  setShowDateRangePicker(false);
                }}>Apply</button>
              ) : (
                <button className="close-modal-button" style={{backgroundColor:'fuchsia',color:'#ffffff'}} onClick={() => {
                  // Clear to defaults
                  if (originalTimelineData.length > 0) {
                    const dates = originalTimelineData.map(e => parseISO(e.date)).sort(compareAsc);
                    const minDate = dates[0];
                    const maxDate = dates[dates.length - 1];
                    setStartDateFilter(format(minDate, 'yyyy-MM-dd'));
                    setEndDateFilter(format(maxDate, 'yyyy-MM-dd'));
                  }
                  const filtered = filterTimelineData(originalTimelineData, searchQuery, showPinsOnly);
                  setTimelineData(filtered);
                  setShowDateRangePicker(false);
                  // cleared filter, dateFilterActive = false
                }}>Clear</button>
              )}
              <button className="close-modal-button" style={{marginLeft:'auto'}} onClick={() => setShowDateRangePicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="row center">
        <div className="form-group">
          <div id="search-box-container">
            <div className="left-icons" style={{gap:'0.7rem'}}> {/* reduce space between icons by about 1/3 */}
              <FaSearch
                className="search-icon"
                style={{color: isChatMode ? 'inherit' : 'fuchsia'}}
                onClick={() => handleToggleMode('search')}
              />
              <MdChatBubbleOutline
                className="chat-icon"
                style={{color: isChatMode ? 'fuchsia' : 'inherit'}}
                onClick={() => handleToggleMode('chat')}
              />
            </div>
            <input
              type="text"
              id="search"
              className="search-input"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onFocus={() => showSearchSuggestions && searchSuggestions.length > 0 && setShowSearchSuggestions(true)}
              onChange={handleSearchChange}
              onBlur={() => setShowSearchSuggestions(false)}
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={clearSearch}
                title="Clear Search"
                aria-label="Clear Search"
              >
                ✖
              </button>
            )}
            <div className="right-icon" style={{right:'0.5rem', color: dateFilterActive ? 'fuchsia' : 'inherit'}}>
              <FaCalendar onClick={() => setShowDateRangePicker(true)} />
            </div>
            {showSearchSuggestions && searchSuggestions.length > 0 && (
              <div className="search-suggestions">
                {searchSuggestions.map((s) => (
                  <div
                    key={s}
                    className="search-suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applySearchSuggestion(s);
                    }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="row center no-wrap-links" style={{marginTop:'1rem',gap:'1rem', whiteSpace:'nowrap'}}>
        <div
          className="more-info"
          onClick={() => setShowUpcomingModal(true)}
          role="button"
          tabIndex={0}
        >
          Upcoming
        </div>
        <div
          className="more-info"
          onClick={() => setShowStatsModal(true)}
          role="button"
          tabIndex={0}
        >
          Stats
        </div>
        <div
          className="more-info"
          onClick={() => setShowInfoModal(true)}
          role="button"
          tabIndex={0}
        >
          More info
        </div>
      </div>

      {isMobile && (
        <div className="mobile-instruction">
          Long press events to toggle pins or delete tags & events
        </div>
      )}

      <div id="timeline-section">
        <div className="timeline-controls">
          <div className="add-event-text" onClick={handleAddNewEvent} title={viewMode === 'timeline' ? "Add New Event" : "Add New Tag"}>
            +
          </div>
          <div className="right-controls">
            {hasMultiplePins && viewMode === 'timeline' && (
              <div
                className="show-pins-only"
                onClick={toggleShowPinsOnly}
                title={showPinsOnly ? 'Show All Events' : 'Show Pins Only'}
              >
                {showPinsOnly ? 'Show All' : 'Show Pins Only'}
              </div>
            )}
            {hasMultiplePins && viewMode === 'timeline' && (
              <div className="clear-pins" onClick={handleClearPins} title="Clear All Pins">
                Clear Pins
              </div>
            )}
          </div>
        </div>
        
        {viewMode === 'timeline' ? (
          <div className="timeline" id="vertical-timeline">
            <div className="timeline-label history-label">History begins...</div>
            {timelineDataWithToday.map((event) => {
              const eventDate = parseISO(event.date);
              const now = new Date();
              const isFutureEvent = isAfter(eventDate, startOfDay(now));
              return (
                <React.Fragment key={event.id}>
                  <TimelineItem
                    event={event}
                    onUpdateEvent={handleUpdateEvent}
                    onTogglePin={handleTogglePin}
                    onDeleteEvent={handleDeleteEvent}
                    onContextMenu={handleContextMenu}
                    onDeleteTag={handleDeleteTagFromEvent}
                    onEditTag={handleEditTag}
                    onTagEdited={handleTagEdited}
                    isMobile={isMobile}
                    allTags={allTags}
                    durations={durations}
                    originalTimelineData={originalTimelineData}
                    ref={(el) => (itemRefs.current[event.id] = el)}
                  />
                  {isFutureEvent && !futureLabelShown && (
                    <>
                      {futureLabelShown = true}
                      <div className="timeline-label future-label" key={`future-label-${event.id}`}>
                        To the future...
                      </div>
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="tags-view-content">
            {Object.keys(groupedTags).length === 0 && <p style={{textAlign:'center'}}>No tags available.</p>}
            {Object.keys(groupedTags).map(group => (
              <div key={group} style={{marginBottom:'1rem'}}>
                <h3>{group}</h3>
                <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
                  {groupedTags[group].map(obj => (
                    <span className={obj.class} key={obj.tag}>{obj.tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isMobile && contextMenu.visible && contextMenu.mode === null && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {(() => {
            const ev = originalTimelineData.find(e => e.id === contextMenu.eventId);
            if (!ev) {
              return (
                <div
                  className="context-menu-item"
                  onClick={() => setContextMenu({ ...contextMenu, visible: false })}
                >
                  No Event Found
                </div>
              );
            }
            const eventTags = ev.tags || [];
            return (
              <>
                <div
                  className="context-menu-item"
                  onClick={() => {
                    const confirmDelete = window.confirm('Are you sure you want to delete this event?');
                    if (confirmDelete) {
                      handleDeleteEvent(contextMenu.eventId);
                    }
                    setContextMenu({ ...contextMenu, visible: false });
                  }}
                >
                  Delete Event
                </div>
                {eventTags.length > 0 && (
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      setContextMenu({ ...contextMenu, mode: 'chooseTagToDelete' });
                    }}
                  >
                    Delete Tag
                  </div>
                )}
                <div
                  className="context-menu-item"
                  onClick={() => {
                    setContextMenu({ ...contextMenu, visible: false });
                  }}
                >
                  Cancel
                </div>
              </>
            );
          })()}
        </div>
      )}

      {!isMobile && contextMenu.visible && contextMenu.mode === 'chooseTagToDelete' && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {(() => {
            const ev = originalTimelineData.find(e => e.id === contextMenu.eventId);
            if (!ev || (ev.tags || []).length === 0) {
              return (
                <div
                  className="context-menu-item"
                  onClick={() => setContextMenu({ ...contextMenu, visible: false, mode: null })}
                >
                  No Tags to Delete
                </div>
              );
            }
            return (
              <>
                {ev.tags.map(tag => (
                  <div
                    key={tag}
                    className="context-menu-item"
                    onClick={() => {
                      const confirmDelete = window.confirm(`Are you sure you want to delete the tag "${tag}"?`);
                      if (confirmDelete) {
                        handleDeleteTagFromEvent(contextMenu.eventId, tag);
                      }
                      setContextMenu({ ...contextMenu, visible: false, mode: null });
                    }}
                  >
                    Delete "{tag}"
                  </div>
                ))}
                <div
                  className="context-menu-item"
                  onClick={() => setContextMenu({ ...contextMenu, visible: false, mode: null })}
                >
                  Cancel
                </div>
              </>
            );
          })()}
        </div>
      )}

      {isMobile && contextMenu.visible && contextMenu.mode === null && (
        <div
          className="mobile-options-modal"
          style={{overflowY:'auto',maxHeight:'80vh',textAlign:'left'}}
        >
          {(() => {
            const ev = originalTimelineData.find(e => e.id === contextMenu.eventId);
            if (!ev) {
              return (
                <button onClick={() => setContextMenu({ ...contextMenu, visible: false })} className="option-button">
                  No Event Found
                </button>
              );
            }
            const eventTags = ev.tags || [];
            return (
              <>
                <button onClick={() => {
                  const confirmDelete = window.confirm('Are you sure you want to delete this event?');
                  if (confirmDelete) {
                    handleDeleteEvent(contextMenu.eventId);
                  }
                  setContextMenu({ ...contextMenu, visible: false });
                }} className="option-button">
                  Delete Event
                </button>
                {eventTags.length > 0 && (
                  <button onClick={() => {
                    setContextMenu({ ...contextMenu, mode: 'chooseTagToDelete', visible: true });
                  }} className="option-button">
                    Delete Tag
                  </button>
                )}
                <button
                  onClick={() => setContextMenu({ ...contextMenu, visible: false })}
                  className="option-button cancel-button"
                >
                  Cancel
                </button>
              </>
            );
          })()}
        </div>
      )}

      {isMobile && contextMenu.visible && contextMenu.mode === 'chooseTagToDelete' && (
        <div className="mobile-options-modal" style={{overflowY:'auto',maxHeight:'80vh',textAlign:'left'}}>
          {(() => {
            const ev = originalTimelineData.find(e => e.id === contextMenu.eventId);
            const eventTags = ev ? ev.tags || [] : [];
            if (!ev || eventTags.length === 0) {
              return (
                <button
                  onClick={() => {
                    setContextMenu({ ...contextMenu, visible: false, mode: null });
                  }}
                  className="option-button"
                >
                  No Tags to Delete
                </button>
              );
            }
            return (
              <>
                {eventTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      const confirmDelete = window.confirm(`Are you sure you want to delete the tag "${tag}"?`);
                      if (confirmDelete) {
                        handleDeleteTagFromEvent(contextMenu.eventId, tag);
                      }
                      setContextMenu({ ...contextMenu, visible: false, mode: null });
                    }}
                    className="option-button"
                  >
                    Delete "{tag}"
                  </button>
                ))}
                <button
                  onClick={() => {
                    setContextMenu({ ...contextMenu, visible: false, mode: null });
                  }}
                  className="option-button cancel-button"
                >
                  Cancel
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function formatDateForInput(dateString) {
  const date = parseISO(dateString);
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - offset * 60000);
  return adjustedDate.toISOString().slice(0, 16);
}

export default App;