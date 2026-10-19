# RN-DEMO-001 — Create and retrieve a note

A demo member may create a note with a title of 1 to 80 UTF-16 code units and an author alias of 1 to 40 UTF-16 code units.
Each successful submission creates a distinct note; its identifier retrieves the unchanged title and alias within the same tenant.
Unknown input fields, null values and values outside these limits are rejected without creating a note.
