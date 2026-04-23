@echo off
echo Rebuilding iso-game Docker container...
docker compose down
docker compose up --build -d
echo.
echo Done. Game is live at http://localhost:8081
pause
