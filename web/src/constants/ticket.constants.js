export const TICKET_STATUS = {
  OPEN: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CLOSED: 4,
};

export const TICKET_STATUS_MAP = {
  [TICKET_STATUS.OPEN]: {
    color: 'blue',
    text: '待处理',
  },
  [TICKET_STATUS.IN_PROGRESS]: {
    color: 'orange',
    text: '处理中',
  },
  [TICKET_STATUS.RESOLVED]: {
    color: 'green',
    text: '已解决',
  },
  [TICKET_STATUS.CLOSED]: {
    color: 'grey',
    text: '已关闭',
  },
};

export const TICKET_PRIORITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const TICKET_PRIORITY_MAP = {
  [TICKET_PRIORITY.LOW]: {
    color: 'green',
    text: '低',
  },
  [TICKET_PRIORITY.MEDIUM]: {
    color: 'blue',
    text: '中',
  },
  [TICKET_PRIORITY.HIGH]: {
    color: 'orange',
    text: '高',
  },
  [TICKET_PRIORITY.CRITICAL]: {
    color: 'red',
    text: '紧急',
  },
};
