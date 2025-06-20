"""
Utility functions for handling tree-based conversation structure.
"""


def get_conversation_path(cursor, conversation_id, active_message_id=None):
    """
    Get the active path of messages in a conversation tree.

    Args:
        cursor: Database cursor
        conversation_id: ID of the conversation
        active_message_id: ID of the currently active message (leaf of the path)
                           If None, gets it from the conversation record

    Returns:
        List of message dictionaries in chronological order (root to leaf)
    """
    if active_message_id is None:
        # Get the active message from the conversation
        cursor.execute(
            "SELECT active_message_id FROM conversations WHERE id = %s",
            (conversation_id,),
        )
        result = cursor.fetchone()
        if not result or not result[0]:
            # No active message set, return all root messages
            return get_root_messages(cursor, conversation_id)
        active_message_id = result[0]

    # Build the path from active message back to root
    path = []
    current_id = active_message_id

    while current_id is not None:
        cursor.execute(
            """
            SELECT 
                id, 
                message_text, 
                sender_name, 
                sent_at, 
                llm_model, 
                llm_provider, 
                parent_message_id
            FROM messages 
            WHERE id = %s AND conversation_id = %s
            """,
            (current_id, conversation_id),
        )
        message = cursor.fetchone()
        if not message:
            break

        path.append(
            {
                'id': message[0],
                'text': message[1],
                'sender': message[2],
                'sent_at': message[3].isoformat() if message[3] else None,
                'llm_model': message[4],
                'llm_provider': message[5],
                'parent_message_id': message[6],
            }
        )

        current_id = message[6]  # parent_message_id

    # Reverse to get chronological order (root to leaf)
    path.reverse()
    return path


def get_root_messages(cursor, conversation_id):
    """
    Get all root messages (messages with no parent) for a conversation.
    """
    cursor.execute(
        """
        SELECT 
            id, 
            message_text, 
            sender_name, 
            sent_at, 
            llm_model, 
            llm_provider, 
            parent_message_id
        FROM messages 
        WHERE conversation_id = %s AND parent_message_id IS NULL
        ORDER BY sent_at ASC
        """,
        (conversation_id,),
    )
    messages = cursor.fetchall()
    return [
        {
            'id': msg[0],
            'text': msg[1],
            'sender': msg[2],
            'sent_at': msg[3].isoformat() if msg[3] else None,
            'llm_model': msg[4],
            'llm_provider': msg[5],
            'parent_message_id': msg[6],
        }
        for msg in messages
    ]


def get_message_children(cursor, message_id):
    """
    Get all direct children of a message.
    """
    cursor.execute(
        """
        SELECT 
            id, 
            message_text, 
            sender_name, 
            sent_at, 
            llm_model, 
            llm_provider, 
            parent_message_id, 
            branch_order
        FROM messages 
        WHERE parent_message_id = %s
        ORDER BY branch_order ASC, sent_at ASC
        """,
        (message_id,),
    )
    messages = cursor.fetchall()
    return [
        {
            'id': msg[0],
            'text': msg[1],
            'sender': msg[2],
            'sent_at': msg[3].isoformat() if msg[3] else None,
            'llm_model': msg[4],
            'llm_provider': msg[5],
            'parent_message_id': msg[6],
            'branch_order': msg[7],
        }
        for msg in messages
    ]


def get_conversation_tree(cursor, conversation_id):
    """
    Get the complete tree structure for a conversation.
    Returns a nested structure with children.
    """
    # Get all messages for the conversation
    cursor.execute(
        """
        SELECT 
            id, 
            message_text, 
            sender_name, 
            sent_at, 
            llm_model, 
            llm_provider, 
            parent_message_id,
            branch_order
        FROM messages 
        WHERE conversation_id = %s
        ORDER BY sent_at ASC
        """,
        (conversation_id,),
    )
    all_messages = cursor.fetchall()

    # Build a lookup dictionary
    messages_dict = {}
    for msg in all_messages:
        messages_dict[msg[0]] = {
            'id': msg[0],
            'text': msg[1],
            'sender': msg[2],
            'sent_at': msg[3].isoformat() if msg[3] else None,
            'llm_model': msg[4],
            'llm_provider': msg[5],
            'parent_message_id': msg[6],
            'branch_order': msg[7],
            'children': [],
        }

    # Build the tree structure
    root_messages = []
    for msg_id, msg_data in messages_dict.items():
        parent_id = msg_data['parent_message_id']
        if parent_id is None:
            root_messages.append(msg_data)
        else:
            if parent_id in messages_dict:
                messages_dict[parent_id]['children'].append(msg_data)

    # Sort children by branch_order
    def sort_children(msg):
        msg['children'].sort(key=lambda x: (x['branch_order'], x['sent_at']))
        for child in msg['children']:
            sort_children(child)

    for root in root_messages:
        sort_children(root)

    return root_messages


def get_next_branch_order(cursor, parent_message_id):
    """
    Get the next branch order number for a new message under a parent.
    """
    if parent_message_id is None:
        return 0

    cursor.execute(
        "SELECT COALESCE(MAX(branch_order), -1) + 1 "
        "FROM messages WHERE parent_message_id = %s",
        (parent_message_id,),
    )
    result = cursor.fetchone()
    return result[0] if result else 0


def set_active_message(cursor, conversation_id, message_id):
    """
    Set the active message for a conversation.
    """
    cursor.execute(
        "UPDATE conversations SET active_message_id = %s WHERE id = %s",
        (message_id, conversation_id),
    )


def messages_to_llm_format(messages):
    """
    Convert message list to format expected by LLM APIs.
    """
    llm_messages = []

    for msg in messages:
        if msg['sender'] == 'system':
            continue  # System messages are handled separately
        elif msg['sender'] == 'user':
            llm_messages.append({"role": "user", "content": msg['text']})
        elif msg['sender'] == 'assistant':
            llm_messages.append({"role": "assistant", "content": msg['text']})

    return llm_messages
